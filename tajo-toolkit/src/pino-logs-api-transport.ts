import build from 'pino-abstract-transport';
import axios from 'axios';

const PINO_LEVELS: Record<number, string> = {
  10: 'debug',
  20: 'debug',
  30: 'info',
  40: 'warning',
  50: 'error',
  60: 'error',
};

export function mapLevel(pinoLevel: number): string {
  return PINO_LEVELS[pinoLevel] || 'info';
}

// Fields managed by pino internals — everything else is application metadata
const PINO_INTERNAL_KEYS = new Set([
  'level', 'time', 'pid', 'hostname', 'name', 'msg', 'message',
  'req', 'res', 'responseTime', 'err',
  'reqId', 'traceId', 'userId', 'context',
  // nestjs-pino adds these
  'v',
]);

function extractAppMeta(obj: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!PINO_INTERNAL_KEYS.has(key)) {
      meta[key] = obj[key];
    }
  }
  return meta;
}

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
export function buildLogPayload(
  obj: Record<string, any>,
  serviceName: string,
): CollectorLog | null {
  const level = mapLevel(obj.level);

  // ms-logs-api only accepts info/warning/error — never ship debug-level logs
  if (level === 'debug') {
    return null;
  }

  const reqUrl = obj.req?.url || '';
  if (reqUrl === '/health' || reqUrl === '/api/health') {
    return null;
  }

  const message = obj.msg || obj.message || '';
  // The CLS trace-id (injected by the pino mixin) is the single source of truth
  // for correlation. Fall back to pino's req.id only when it is absent.
  const correlationId = obj.traceId || obj.req?.id || obj.reqId || null;

  const appMeta = extractAppMeta(obj);
  // Keep `entity` reserved for the service identity; route domain goes to meta.domain.
  if (typeof appMeta.entity === 'string' && appMeta.entity) {
    appMeta.domain = appMeta.entity;
    delete appMeta.entity;
  }

  return {
    level,
    entity: serviceName,
    message:
      message ||
      `[${obj.req?.method || 'LOG'}] ${reqUrl || 'system'} ${obj.res?.statusCode || ''}`.trim(),
    source: serviceName,
    correlationId,
    meta: {
      ...(obj.req ? { method: obj.req.method, path: obj.req.url } : {}),
      ...(obj.res ? { statusCode: obj.res.statusCode } : {}),
      ...(obj.responseTime ? { duration: Math.round(obj.responseTime) } : {}),
      ...(obj.err ? { error: obj.err.message, stack: obj.err.stack } : {}),
      ...appMeta,
    },
  };
}

export default function (opts: PinoLogsApiTransportOptions) {
  return build(async function (source) {
    for await (const obj of source) {
      const payload = buildLogPayload(obj, opts.serviceName);
      if (!payload) {
        continue;
      }

      const headers: Record<string, string> = {};
      if (opts.apiKey) {
        headers['x-api-key'] = opts.apiKey;
      }
      axios.post(`${opts.logsApiUrl}/api/logs`, payload, { headers }).catch(() => {});
    }
  });
}
