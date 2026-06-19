import { extractTraceId } from './extract-trace-id';

const VALID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('extractTraceId', () => {
  it('returns the incoming trace-id when it is a valid UUID', () => {
    expect(extractTraceId({ 'x-trace-id': VALID })).toBe(VALID);
  });

  it('mints a new UUID when the header is missing', () => {
    const id = extractTraceId({});
    expect(typeof id).toBe('string');
    expect(id).not.toBe('');
  });

  it('mints a new UUID when the header is a malformed trace-id', () => {
    expect(extractTraceId({ 'x-trace-id': 'not-a-uuid' })).not.toBe('not-a-uuid');
    expect(extractTraceId({ 'x-trace-id': '11111111-1111-1111-1111-111111111111' }))
      .not.toBe('11111111-1111-1111-1111-111111111111');
  });

  it('handles null/undefined header bags', () => {
    expect(typeof extractTraceId(null)).toBe('string');
    expect(typeof extractTraceId(undefined)).toBe('string');
  });
});
