import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import axios from 'axios';

import { IDataProvider } from '@domain/ports/data-provider.port';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { NormalizedTimeSeriesResult } from '@domain/results/normalized-timeseries.result';
import { ProviderError } from '@domain/errors/provider.error';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { mapPiJsonToNormalized } from '@infrastructure/services/pi-json.mapper';
import { toFewsTime } from '@infrastructure/services/fews-task-client.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A 206 means part of what was asked for is not yet visible to the web service. */
const HTTP_PARTIAL_CONTENT = 206;

/**
 * What a FEWS_API provider carries in `settings`. Every field is optional so a
 * provider created before a field existed keeps working; the seeds fill them all.
 *
 *   filterId      — subfilter of the default filter the series are read under
 *   parameterIds  — one or more parameter ids (array, or comma-separated string)
 *   locationIds   — optional location restriction, same shape
 *   ensembleId    — only for ensemble products such as RS Minerve
 *   horizonDays   — days AFTER the anchor hour to ask for (forecasts)
 *   lookbackDays  — days BEFORE the anchor hour to ask for (observed data)
 *   servicePath   — overrides the PI REST path for this provider only
 */
export interface FewsProviderSettings {
    filterId?: string;
    parameterIds?: string | string[];
    locationIds?: string | string[];
    ensembleId?: string;
    horizonDays?: number | string;
    lookbackDays?: number | string;
    servicePath?: string;
}

export interface FewsQueryWindow {
    startTime: Date;
    endTime: Date;
}

/** Splits a comma-separated string or passes an array through, dropping blanks. */
export function toIdList(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw.map((value) => String(value).trim()).filter((value) => value.length > 0);
    }
    if (typeof raw === 'string') {
        return raw
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
    }
    return [];
}

function toDays(raw: unknown): number {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * The search period Idrica documents for every GET: anchored on the `:00`
 * before now (UTC), `lookbackDays` behind it and `horizonDays` ahead of it.
 * Returns null when neither is set, so a provider that never declared a window
 * keeps asking the way it always did.
 */
export function buildQueryWindow(now: Date, settings: FewsProviderSettings): FewsQueryWindow | null {
    const horizonDays = toDays(settings.horizonDays);
    const lookbackDays = toDays(settings.lookbackDays);
    if (horizonDays === 0 && lookbackDays === 0) {
        return null;
    }

    const anchor = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    return {
        startTime: new Date(anchor - lookbackDays * DAY_MS),
        endTime: new Date(anchor + horizonDays * DAY_MS),
    };
}

/**
 * Builds the query string the PI REST service expects. `parameterIds` and
 * `locationIds` are repeated per value (`parameterIds=A&parameterIds=B`): the
 * service declares them as repeatable array parameters and does not split a
 * comma-joined value.
 */
export function buildQueryParams(settings: FewsProviderSettings, window: FewsQueryWindow | null): URLSearchParams {
    const params = new URLSearchParams();
    params.set('documentFormat', 'PI_JSON');

    if (settings.filterId) params.set('filterId', String(settings.filterId));
    for (const id of toIdList(settings.parameterIds)) params.append('parameterIds', id);
    for (const id of toIdList(settings.locationIds)) params.append('locationIds', id);
    if (settings.ensembleId) params.set('ensembleId', String(settings.ensembleId));

    if (window) {
        params.set('startTime', toFewsTime(window.startTime));
        params.set('endTime', toFewsTime(window.endTime));
    }

    return params;
}

/**
 * Reads forecast and observed series straight from the Delft-FEWS PI REST
 * service, as the scheduled counterpart of the SFTP JSON providers: one provider
 * per block of Idrica's endpoint sheet, same downstream event.
 */
@Injectable()
export class FewsApiProviderService implements IDataProvider {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly fewsApiConfigService: FewsApiConfigService,
    ) {}

    async fetch(config: ProviderConfig): Promise<NormalizedTimeSeriesResult[]> {
        const settings = (config.settings || {}) as FewsProviderSettings;
        const baseUrl = (config.baseUrl || this.fewsApiConfigService.baseUrl || '').replace(/\/+$/, '');
        if (!baseUrl) {
            throw new ProviderError('FEWS API base url is not configured (FEWS_API_BASE_URL or provider baseUrl)');
        }

        const servicePath = String(settings.servicePath || this.fewsApiConfigService.servicePath).replace(/\/+$/, '');
        const url = `${baseUrl}${servicePath.startsWith('/') ? servicePath : `/${servicePath}`}/timeseries`;
        const window = buildQueryWindow(new Date(), settings);
        const params = buildQueryParams(settings, window);

        if (!window) {
            this.logger.warn({
                msg: 'FEWS provider has no horizonDays/lookbackDays — asking without a period, FEWS decides what to return',
                entity: 'Ingestion',
                providerConfigId: config.id,
            });
        }

        this.logger.log({
            msg: 'Fetching FEWS API timeseries',
            entity: 'Ingestion',
            providerConfigId: config.id,
            url,
            query: params.toString(),
        });

        const piJson = await this.request(url, params);
        const mapped = mapPiJsonToNormalized(piJson, (message, context) =>
            this.logger.warn({ msg: message, entity: 'Ingestion', providerConfigId: config.id, ...context }),
        );

        this.logger.log({
            msg: 'FEWS API ingestion complete',
            entity: 'Ingestion',
            providerConfigId: config.id,
            seriesCount: mapped.series.length,
            skippedEmptySeries: mapped.skippedEmptySeries,
            skippedInvalidSeries: mapped.skippedInvalidSeries,
        });

        return mapped.series;
    }

    private async request(url: string, params: URLSearchParams): Promise<unknown> {
        const username = this.fewsApiConfigService.username;
        const password = this.fewsApiConfigService.password;

        let response;
        try {
            response = await axios.get(url, {
                params,
                timeout: this.fewsApiConfigService.requestTimeoutMs,
                responseType: 'json',
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                auth: username ? { username, password } : undefined,
                headers: { Accept: 'application/json' },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error({ msg: 'FEWS API fetch failed', entity: 'Ingestion', url, error: message });
            throw new ProviderError(`FEWS API fetch failed: ${message}`);
        }

        if (response.status === HTTP_PARTIAL_CONTENT) {
            // Persisting a partial answer would look like a successful ingestion
            // with data missing. Failing the run keeps the gap visible; the next
            // scheduled tick asks again.
            throw new ProviderError('FEWS answered 206: the requested series are not completely available yet');
        }

        return response.data;
    }
}
