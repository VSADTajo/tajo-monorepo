import build from 'pino-abstract-transport';
export declare function mapLevel(pinoLevel: number): string;
export interface PinoLogsApiTransportOptions {
    logsApiUrl: string;
    serviceName: string;
    apiKey?: string;
}
export interface CollectorLog {
    level: string;
    entity: string;
    message: string;
    source: string;
    correlationId: string | null;
    meta: Record<string, unknown>;
}
/**
 * Pure transform: pino log object -> ms-logs-api payload.
 *
 * Returns `null` when the log must be skipped (debug level or health checks).
 * Invariants enforced here:
 *  - `entity`/`source` is ALWAYS the serviceName (never a route-derived value).
 *  - A route-derived `entity` in app metadata is moved to `meta.domain`.
 *  - `correlationId` prefers the CLS trace-id, falling back to pino's req.id.
 */
export declare function buildLogPayload(obj: Record<string, any>, serviceName: string): CollectorLog | null;
export default function (opts: PinoLogsApiTransportOptions): import("node:stream").Transform & build.OnUnknown;
//# sourceMappingURL=pino-logs-api-transport.d.ts.map