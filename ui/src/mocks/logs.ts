import type { LogEntry, LogLevel } from '../types/log';

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLogs(entity: string, count: number): LogEntry[] {
  const levels: LogLevel[] = ['info', 'warning', 'error'];
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  function buildMessage(level: LogLevel, index: number) {
    // Create a long JSON string to test table rendering
    const payload = {
      level,
      index,
      correlationId: `corr-${entity}-${index}-${randomBetween(1000, 9999)}`,
      details: {
        entity,
        stage: pick(['ingest', 'validate', 'transform', 'inference', 'dispatch']),
        region: pick(['us-east-1', 'eu-west-1', 'sa-east-1']),
        retry: randomBetween(0, 3),
        latencyMs: randomBetween(20, 2500),
        sizes: {
          input: randomBetween(10_000, 1_000_000),
          output: randomBetween(1_000, 500_000)
        }
      },
      meta: {
        tags: [pick(['cold-start', 'hot-path', 'cron']), pick(['ab-test', 'blue-green', 'canary'])],
        features: {
          a: Math.random() > 0.5,
          b: Math.random() > 0.5,
          c: Math.random() > 0.5
        }
      },
      message: pick([
        'Operation completed',
        'Transient failure detected',
        'Queued for retry',
        'Dispatch successful'
      ])
    };
    return JSON.stringify(payload);
  }

  return Array.from({ length: count }).map((_, i) => {
    const ts = new Date(now - randomBetween(0, sevenDaysMs)).toISOString();
    const level = pick(levels);
    const msg = buildMessage(level, i + 1);
    return {
      id: `${entity}-${i + 1}`,
      entity,
      timestamp: ts,
      level,
      message: msg,
      meta: {
        attempt: randomBetween(1, 3),
        durationMs: randomBetween(50, 2000)
      }
    } satisfies LogEntry;
  });
}

const predictions = generateLogs('predictions', 60);
const notifications = generateLogs('notifications', 60);
const stations = generateLogs('stations', 60);

export const mockedLogs: LogEntry[] = [...predictions, ...notifications, ...stations].sort(
  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
);

