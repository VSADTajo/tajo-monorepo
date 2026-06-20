import { buildPinoOptions } from './pino-options';
import { TraceContext } from './trace-context';

function fakeTraceContext(traceId: string | null, userId: string | null): TraceContext {
  return { traceId, userId } as unknown as TraceContext;
}

const base = {
  serviceName: 'ms-gateway-api',
  traceContext: fakeTraceContext('trace-123', 'user-9'),
};

describe('buildPinoOptions', () => {
  it('classifies levels: 5xx/err -> error, 4xx -> warn, 2xx -> info', () => {
    const opts = buildPinoOptions(base) as any;
    expect(opts.customLogLevel({}, { statusCode: 200 }, undefined)).toBe('info');
    expect(opts.customLogLevel({}, { statusCode: 404 }, undefined)).toBe('warn');
    expect(opts.customLogLevel({}, { statusCode: 503 }, undefined)).toBe('error');
    expect(opts.customLogLevel({}, { statusCode: 200 }, new Error('x'))).toBe('error');
  });

  it('mixin injects the CLS trace-id and user-id on every log', () => {
    const opts = buildPinoOptions(base) as any;
    expect(opts.mixin()).toEqual({ traceId: 'trace-123', userId: 'user-9' });
  });

  it('mixin returns empty object when no trace context is active', () => {
    const opts = buildPinoOptions({ ...base, traceContext: fakeTraceContext(null, null) }) as any;
    expect(opts.mixin()).toEqual({});
  });

  it('genReqId reuses the incoming x-trace-id header', () => {
    const opts = buildPinoOptions(base) as any;
    expect(opts.genReqId({ headers: { 'x-trace-id': 'incoming' } })).toBe('incoming');
  });

  it('genReqId mints an id when the header is absent', () => {
    const opts = buildPinoOptions(base) as any;
    const id = opts.genReqId({ headers: {} });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('redacts sensitive fields', () => {
    const opts = buildPinoOptions(base) as any;
    expect(opts.redact.paths).toEqual(
      expect.arrayContaining(['req.headers.authorization', '*.password', '*.token']),
    );
    expect(opts.redact.censor).toBe('[REDACTED]');
  });

  it('adds the collector transport only when logsApiUrl is set', () => {
    const withCollector = buildPinoOptions({ ...base, logsApiUrl: 'http://logs', nodeEnv: 'production' }) as any;
    const targets = withCollector.transport.targets.map((t: any) => t.target);
    expect(targets).toContain('tajo-toolkit/dist/pino-logs-api-transport');

    const withoutCollector = buildPinoOptions(base) as any;
    const targets2 = withoutCollector.transport.targets.map((t: any) => t.target);
    expect(targets2).not.toContain('tajo-toolkit/dist/pino-logs-api-transport');
  });
});
