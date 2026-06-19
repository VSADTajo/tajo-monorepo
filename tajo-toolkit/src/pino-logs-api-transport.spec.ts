import { buildLogPayload, mapLevel, sanitizeUrl } from './pino-logs-api-transport';

const SERVICE = 'ms-gateway-api';

describe('sanitizeUrl', () => {
  it('returns the url unchanged when there is no query string', () => {
    expect(sanitizeUrl('/users/123')).toBe('/users/123');
  });

  it('strips sensitive query params but keeps the rest', () => {
    expect(sanitizeUrl('/auth/callback?code=abc&state=xyz')).toBe('/auth/callback?state=xyz');
    expect(sanitizeUrl('/reset?token=secret')).toBe('/reset');
  });

  it('is case-insensitive for sensitive param names', () => {
    expect(sanitizeUrl('/x?Token=abc&ok=1')).toBe('/x?ok=1');
  });
});

describe('mapLevel', () => {
  it('maps pino numeric levels to collector enum (warn -> warning)', () => {
    expect(mapLevel(10)).toBe('debug');
    expect(mapLevel(20)).toBe('debug');
    expect(mapLevel(30)).toBe('info');
    expect(mapLevel(40)).toBe('warning');
    expect(mapLevel(50)).toBe('error');
    expect(mapLevel(60)).toBe('error');
  });

  it('defaults unknown levels to info', () => {
    expect(mapLevel(999)).toBe('info');
  });
});

describe('buildLogPayload', () => {
  it('uses the CLS trace-id as correlationId, not pino req.id', () => {
    const payload = buildLogPayload(
      { level: 30, msg: 'hi', traceId: 'cls-trace', req: { id: 'pino-req', url: '/x' } },
      SERVICE,
    );
    expect(payload?.correlationId).toBe('cls-trace');
  });

  it('falls back to req.id only when trace-id is absent', () => {
    const payload = buildLogPayload(
      { level: 30, msg: 'hi', req: { id: 'pino-req', url: '/x' } },
      SERVICE,
    );
    expect(payload?.correlationId).toBe('pino-req');
  });

  it('always sets entity/source to the serviceName', () => {
    const payload = buildLogPayload({ level: 30, msg: 'hi', entity: 'Auth' }, SERVICE);
    expect(payload?.entity).toBe(SERVICE);
    expect(payload?.source).toBe(SERVICE);
  });

  it('moves a route-derived entity into meta.domain', () => {
    const payload = buildLogPayload({ level: 30, msg: 'hi', entity: 'Auth' }, SERVICE);
    expect(payload?.meta.domain).toBe('Auth');
    expect(payload?.meta.entity).toBeUndefined();
  });

  it('skips debug-level logs (collector enum has no debug)', () => {
    expect(buildLogPayload({ level: 20, msg: 'noise' }, SERVICE)).toBeNull();
  });

  it('skips health-check logs', () => {
    expect(buildLogPayload({ level: 30, req: { url: '/health' } }, SERVICE)).toBeNull();
    expect(buildLogPayload({ level: 30, req: { url: '/api/health' } }, SERVICE)).toBeNull();
  });

  it('does not leak the raw trace-id/req internals into meta', () => {
    const payload = buildLogPayload(
      { level: 30, msg: 'hi', traceId: 't', reqId: 'r', context: 'c', custom: 'keep' },
      SERVICE,
    );
    expect(payload?.meta.traceId).toBeUndefined();
    expect(payload?.meta.reqId).toBeUndefined();
    expect(payload?.meta.context).toBeUndefined();
    expect(payload?.meta.custom).toBe('keep');
  });

  it('summarizes request/response into meta', () => {
    const payload = buildLogPayload(
      { level: 30, req: { method: 'POST', url: '/login' }, res: { statusCode: 201 }, responseTime: 12.6 },
      SERVICE,
    );
    expect(payload?.meta).toMatchObject({ method: 'POST', path: '/login', statusCode: 201, duration: 13 });
  });
});
