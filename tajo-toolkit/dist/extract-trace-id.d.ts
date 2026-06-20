/**
 * Extract a valid trace-id from RabbitMQ message headers (or any header bag),
 * falling back to a freshly minted UUID. Mirrors the validation done by
 * TraceMiddleware for HTTP, so consumers never propagate a malformed trace-id.
 */
export declare function extractTraceId(headers: Record<string, unknown> | null | undefined): string;
//# sourceMappingURL=extract-trace-id.d.ts.map