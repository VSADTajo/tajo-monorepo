import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { IDataProvider } from '@domain/ports/data-provider.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { NormalizedTimeSeriesResult } from '@domain/results/normalized-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { WiskiApiConfigService } from '@config/wiski-api/wiski-api-config.service';
import { WiskiObservedRecord, toNormalizedTimeSeries } from '@infrastructure/services/wiski-json.mapper';

/** How many unresolved variables to name in the log before truncating. */
const REPORTED_VARIABLE_SAMPLE = 10;
/** How much of an error response body to log. */
const RESPONSE_BODY_SNIPPET = 1000;

@Injectable()
export class WiskiApiProviderService implements IDataProvider {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly wiskiApiConfigService: WiskiApiConfigService,
    ) {}

    async fetch(config: ProviderConfig): Promise<NormalizedTimeSeriesResult[]> {
        const records = await this.fetchRecords(config);

        if (records.length === 0) {
            this.logger.warn({
                msg: 'WISKI endpoint answered no readings',
                entity: 'Ingestion',
                providerConfigId: config.id,
            });
            return [];
        }

        const mapped = toNormalizedTimeSeries(records, { sourceTimezone: this.resolveTimezone(config) });

        if (mapped.skippedVariables.length > 0) {
            this.logger.warn({
                msg: 'WISKI variables dropped — their name follows no known instrument code',
                entity: 'Ingestion',
                providerConfigId: config.id,
                skippedCount: mapped.skippedVariables.length,
                sample: mapped.skippedVariables.slice(0, REPORTED_VARIABLE_SAMPLE),
            });
        }

        this.logger.log({
            msg: 'WISKI API ingestion complete',
            entity: 'Ingestion',
            providerConfigId: config.id,
            readingCount: records.length,
            seriesCount: mapped.series.length,
            resolvedCount: mapped.resolvedCount,
            skippedCount: mapped.skippedVariables.length,
            invalidEventCount: mapped.invalidEventCount,
        });

        return mapped.series;
    }

    // ─────────────────────────────────────────────────────────────
    // HTTP
    // ─────────────────────────────────────────────────────────────

    private async fetchRecords(config: ProviderConfig): Promise<WiskiObservedRecord[]> {
        const settings = config.settings || {};
        const baseUrl = (config.baseUrl || this.wiskiApiConfigService.baseUrl || '').replace(/\/+$/, '');

        // Fail with the reason rather than issuing a request to nowhere: their
        // host does not resolve outside their network, and an unconfigured base
        // url otherwise surfaces as an opaque DNS error.
        if (!baseUrl) {
            throw new ProviderError('WISKI API base url is not configured (WISKI_API_BASE_URL or provider baseUrl)');
        }

        const path = String(settings.endpointPath || this.wiskiApiConfigService.path);
        const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

        // Free-form so a filter we do not know yet (a date range, a station
        // list) becomes a config change instead of a release.
        const params = this.resolveQueryParams(settings.queryParams);
        const token = this.wiskiApiConfigService.token;
        const headers: Record<string, string> = {
            Accept: 'application/json',
            ...(token ? { Authorization: `Token ${token}` } : {}),
        };

        // The exact request as a curl, so a failing ingestion can be replayed by
        // hand. The token is masked (edges + length) — enough to spot a wrong,
        // truncated or quoted value without leaking it into the central logs.
        this.logger.log({
            msg: 'Fetching WISKI observed data',
            entity: 'Ingestion',
            url,
            params,
            tokenConfigured: token.length > 0,
            tokenLength: token.length,
            curl: this.toCurl(url, params, headers, token),
        });

        try {
            const response = await axios.get(url, {
                params,
                timeout: this.wiskiApiConfigService.requestTimeoutMs,
                maxContentLength: this.wiskiApiConfigService.maxResponseBytes,
                maxBodyLength: this.wiskiApiConfigService.maxResponseBytes,
                responseType: 'json',
                headers,
            });

            this.logger.log({
                msg: 'WISKI API responded',
                entity: 'Ingestion',
                status: response.status,
                contentType: response.headers?.['content-type'],
                readingCount: Array.isArray(response.data) ? response.data.length : undefined,
            });

            const payload = response.data;
            if (!Array.isArray(payload)) {
                throw new Error(`expected a JSON array of readings, got ${typeof payload}`);
            }

            return payload as WiskiObservedRecord[];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // What WISKI actually answered (status + body) or the network error
            // code — "status code 401" alone does not say why.
            const response = axios.isAxiosError(error) ? error.response : undefined;
            this.logger.error({
                msg: 'WISKI API fetch failed',
                entity: 'Ingestion',
                url,
                error: message,
                code: axios.isAxiosError(error) ? error.code : undefined,
                status: response?.status,
                statusText: response?.statusText,
                responseHeaders: response?.headers,
                responseBody: this.snippet(response?.data),
                curl: this.toCurl(url, params, headers, token),
            });
            throw new ProviderError(`WISKI API fetch failed: ${message}`);
        }
    }

    private toCurl(url: string, params: Record<string, string>, headers: Record<string, string>, token: string): string {
        const query = new URLSearchParams(params).toString();
        const fullUrl = query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;
        const headerArgs = Object.entries(headers)
            .map(([name, value]) => `-H "${name}: ${token ? value.replace(token, this.maskToken(token)) : value}"`)
            .join(' ');
        return `curl -sS -i ${headerArgs} "${fullUrl}"`;
    }

    private maskToken(token: string): string {
        return token.length <= 8 ? `<${token.length} chars>` : `${token.slice(0, 4)}…${token.slice(-4)}`;
    }

    private snippet(data: unknown): string | undefined {
        if (data === undefined || data === null) return undefined;
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        return text.length > RESPONSE_BODY_SNIPPET ? `${text.slice(0, RESPONSE_BODY_SNIPPET)}…` : text;
    }

    // ─────────────────────────────────────────────────────────────
    // Settings
    // ─────────────────────────────────────────────────────────────


    private resolveTimezone(config: ProviderConfig): string {
        const settings = config.settings || {};
        const fromSettings = settings.sourceTimezone;
        return typeof fromSettings === 'string' && fromSettings.trim().length > 0
            ? fromSettings.trim()
            : this.wiskiApiConfigService.timezone;
    }


    private resolveQueryParams(raw: unknown): Record<string, string> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

        return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
            if (value !== null && value !== undefined) acc[key] = String(value);
            return acc;
        }, {});
    }
}
