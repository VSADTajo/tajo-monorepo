import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { X_TRACE_ID_HEADER } from './types';

/**
 * Extract a valid trace-id from RabbitMQ message headers (or any header bag),
 * falling back to a freshly minted UUID. Mirrors the validation done by
 * TraceMiddleware for HTTP, so consumers never propagate a malformed trace-id.
 */
export function extractTraceId(headers: Record<string, unknown> | null | undefined): string {
  const incoming = headers?.[X_TRACE_ID_HEADER];
  return typeof incoming === 'string' && uuidValidate(incoming) ? incoming : uuidv4();
}
