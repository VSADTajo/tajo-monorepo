"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPinoOptions = buildPinoOptions;
const uuid_1 = require("uuid");
const types_1 = require("./types");
/**
 * Single source of truth for pino configuration across every NestJS service.
 *
 * Returns the `pinoHttp` object that each service plugs into
 * `LoggerModule.forRootAsync`. Encapsulates: the trace-id mixin (so the CLS
 * trace-id lands on every log line), unified request-id generation, log levels
 * (4xx -> warn, 5xx -> error, 2xx -> info), redaction of sensitive fields, and
 * the transport targets (pretty in dev, ms-logs-api collector in prod).
 */
function buildPinoOptions(params) {
    const { serviceName, traceContext, logsApiUrl, apiKey, nodeEnv } = params;
    const level = params.logLevel || 'info';
    const targets = [
        nodeEnv === 'production'
            ? { target: 'pino/file', options: { destination: 1 }, level }
            : { target: 'pino-pretty', options: { singleLine: true }, level },
    ];
    if (logsApiUrl) {
        targets.push({
            target: 'tajo-toolkit/dist/pino-logs-api-transport',
            options: { logsApiUrl, serviceName, apiKey },
            // Collector only stores info/warning/error — debug is filtered in the transport.
            level: 'info',
        });
    }
    return {
        level,
        // req.id == CLS trace-id: read the (re-injected) trace header, else mint one.
        genReqId: (req) => req.headers[types_1.X_TRACE_ID_HEADER] || (0, uuid_1.v4)(),
        // Put the CLS trace-id (and user-id) on every single log line.
        mixin: () => {
            try {
                const traceId = traceContext.traceId;
                const userId = traceContext.userId;
                return {
                    ...(traceId ? { traceId } : {}),
                    ...(userId ? { userId } : {}),
                };
            }
            catch {
                return {};
            }
        },
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500)
                return 'error';
            if (res.statusCode >= 400)
                return 'warn';
            return 'info';
        },
        autoLogging: true,
        // Never let secrets reach the logs (see security standard 2.4).
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'password',
                '*.password',
                'token',
                '*.token',
                'secret',
                '*.secret',
            ],
            censor: '[REDACTED]',
        },
        serializers: {
            req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
            }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
        transport: { targets },
    };
}
//# sourceMappingURL=pino-options.js.map