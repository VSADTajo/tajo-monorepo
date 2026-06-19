"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTraceId = extractTraceId;
const uuid_1 = require("uuid");
const types_1 = require("./types");
/**
 * Extract a valid trace-id from RabbitMQ message headers (or any header bag),
 * falling back to a freshly minted UUID. Mirrors the validation done by
 * TraceMiddleware for HTTP, so consumers never propagate a malformed trace-id.
 */
function extractTraceId(headers) {
    const incoming = headers?.[types_1.X_TRACE_ID_HEADER];
    return typeof incoming === 'string' && (0, uuid_1.validate)(incoming) ? incoming : (0, uuid_1.v4)();
}
//# sourceMappingURL=extract-trace-id.js.map