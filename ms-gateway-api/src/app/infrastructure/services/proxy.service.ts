import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import axios, { AxiosRequestConfig } from 'axios';

import { ProviderError } from '@domain/errors/provider.error';

const CORRELATION_ID_HEADER = 'x-trace-id';

@Injectable()
export class ProxyService {
    constructor(@Inject(Logger) private readonly logger: Logger) {}

    async forward(config: {
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        baseUrl: string;
        path: string;
        body?: unknown;
        headers?: Record<string, string>;
        query?: Record<string, string | string[]>;
        user?: { userId: string; roles: string[]; name?: string };
        timeoutMs?: number;
        responseType?: 'arraybuffer';
        traceId?: string;
    }): Promise<{ status: number; data: unknown; contentType?: string }> {
        const url = `${config.baseUrl}${config.path}`;
        const correlationId = config.traceId || config.headers?.[CORRELATION_ID_HEADER] || randomUUID();
        this.logger.debug(`Proxying ${config.method} ${url} [${CORRELATION_ID_HEADER}: ${correlationId}]`);

        const axiosConfig: AxiosRequestConfig = {
            method: config.method,
            url,
            data: config.body,
            params: config.query,
            responseType: config.responseType,
            paramsSerializer: (params) => {
                const search = new URLSearchParams();
                for (const [key, value] of Object.entries(params)) {
                    if (Array.isArray(value)) {
                        for (const v of value) search.append(key, v);
                    } else if (value !== undefined && value !== null) {
                        search.append(key, String(value));
                    }
                }
                return search.toString();
            },
            timeout: config.timeoutMs ?? 30_000,
            headers: {
                'Content-Type': 'application/json',
                [CORRELATION_ID_HEADER]: correlationId,
                ...(config.headers?.authorization ? { Authorization: config.headers.authorization } : {}),
                ...(config.headers?.['x-internal-caller']
                    ? { 'x-internal-caller': config.headers['x-internal-caller'] }
                    : {}),
                ...(config.user
                    ? {
                          'x-user-id': config.user.userId,
                          'x-user-roles': config.user.roles.join(','),
                          ...(config.user.name ? { 'x-user-name': encodeURIComponent(config.user.name) } : {}),
                      }
                    : {}),
            },
            validateStatus: () => true,
        };

        try {
            const response = await axios.request(axiosConfig);
            return {
                status: response.status,
                data: response.data,
                contentType: response.headers['content-type'] as string | undefined,
            };
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
                this.logger.warn({ msg: 'Proxy timeout', entity: 'Proxy', method: config.method, url });
                return { status: 504, data: { message: 'Upstream service timed out' } };
            }
            this.logger.error({
                msg: 'Proxy error',
                entity: 'Proxy',
                method: config.method,
                url,
                error: String(error),
            });
            throw new ProviderError(`Failed to proxy request to ${url}: ${error}`);
        }
    }
}
