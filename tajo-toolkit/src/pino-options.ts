import type { TransportTargetOptions } from 'pino';
import type { Options } from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import { TraceContext } from './trace-context';
import { X_TRACE_ID_HEADER } from './types';

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
export function buildPinoOptions(params: BuildPinoOptionsParams): Options {
  const { serviceName, traceContext, logsApiUrl, apiKey, nodeEnv } = params;
  const level = params.logLevel || 'info';

  const targets: TransportTargetOptions[] = [
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
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }): string =>
      (req.headers[X_TRACE_ID_HEADER] as string) || uuidv4(),
    // Put the CLS trace-id (and user-id) on every single log line.
    mixin: (): Record<string, unknown> => {
      try {
        const traceId = traceContext.traceId;
        const userId = traceContext.userId;
        return {
          ...(traceId ? { traceId } : {}),
          ...(userId ? { userId } : {}),
        };
      } catch {
        return {};
      }
    },
    customLogLevel: (_req: unknown, res: { statusCode: number }, err: unknown) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
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
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    transport: { targets },
  };
}
