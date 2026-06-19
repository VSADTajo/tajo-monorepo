import type { Options } from 'pino-http';
import { TraceContext } from './trace-context';
export interface BuildPinoOptionsParams {
    /** Service identity — becomes the `entity`/`source` of every log. */
    serviceName: string;
    /** CLS-backed trace context, injected by the consuming service. */
    traceContext: TraceContext;
    /** ms-logs-api collector URL. When absent, logs stay local (dev). */
    logsApiUrl?: string;
    /** API key for the collector. */
    apiKey?: string;
    /** Minimum level the logger emits. Defaults to 'info'. */
    logLevel?: string;
    /** When 'production', ships to the collector; otherwise pretty-prints. */
    nodeEnv?: string;
}
/**
 * Single source of truth for pino configuration across every NestJS service.
 *
 * Returns the `pinoHttp` object that each service plugs into
 * `LoggerModule.forRootAsync`. Encapsulates: the trace-id mixin (so the CLS
 * trace-id lands on every log line), unified request-id generation, log levels
 * (4xx -> warn, 5xx -> error, 2xx -> info), redaction of sensitive fields, and
 * the transport targets (pretty in dev, ms-logs-api collector in prod).
 */
export declare function buildPinoOptions(params: BuildPinoOptionsParams): Options;
//# sourceMappingURL=pino-options.d.ts.map