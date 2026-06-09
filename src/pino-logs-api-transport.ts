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

function mapLevel(pinoLevel: number): string {
  return PINO_LEVELS[pinoLevel] || 'info';
}

// Fields managed by pino internals — everything else is application metadata
const PINO_INTERNAL_KEYS = new Set([
  'level', 'time', 'pid', 'hostname', 'name', 'msg', 'message',
  'req', 'res', 'responseTime', 'err',
  'reqId', 'traceId', 'context',
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

export default function (opts: PinoLogsApiTransportOptions) {
  return build(async function (source) {
    for await (const obj of source) {
      const level = mapLevel(obj.level);
      const message = obj.msg || obj.message || '';
      const reqId = obj.req?.id || obj.reqId || obj.traceId || null;

      // Skip health endpoint logs
      const reqUrl = obj.req?.url || '';
      if (reqUrl === '/health' || reqUrl === '/api/health') {
        continue;
      }

      // Extract application-level metadata (entity, event, ids, etc.)
      const appMeta = extractAppMeta(obj);

      // Move domain entity into meta.domain, keep entity as serviceName
      if (typeof appMeta.entity === 'string' && appMeta.entity) {
        appMeta.domain = appMeta.entity;
        delete appMeta.entity;
      }

      const payload = {
        level,
        entity: opts.serviceName,
        message: message || `[${obj.req?.method || 'LOG'}] ${reqUrl || 'system'} ${obj.res?.statusCode || ''}`.trim(),
        source: opts.serviceName,
        correlationId: reqId,
        meta: {
          ...(obj.req ? { method: obj.req.method, path: obj.req.url } : {}),
          ...(obj.res ? { statusCode: obj.res.statusCode } : {}),
          ...(obj.responseTime ? { duration: Math.round(obj.responseTime) } : {}),
          ...(obj.err ? { error: obj.err.message, stack: obj.err.stack } : {}),
          ...appMeta,
        },
      };

      const headers: Record<string, string> = {};
      if (opts.apiKey) {
        headers['x-api-key'] = opts.apiKey;
      }
      axios.post(`${opts.logsApiUrl}/api/logs`, payload, { headers }).catch(() => {});
    }
  });
}
