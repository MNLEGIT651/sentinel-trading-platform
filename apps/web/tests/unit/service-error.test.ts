import { describe, expect, it } from 'vitest';
import {
  ServiceError,
  extractErrorMessage,
  serializeServiceError,
  type ServiceErrorBody,
} from '@/lib/service-error';

// ---------------------------------------------------------------------------
// ServiceError
// ---------------------------------------------------------------------------

describe('ServiceError', () => {
  it('stores all options correctly', () => {
    const err = new ServiceError('Engine timeout', {
      code: 'timeout',
      service: 'engine',
      retryable: true,
      status: 504,
    });

    expect(err.message).toBe('Engine timeout');
    expect(err.name).toBe('ServiceError');
    expect(err.code).toBe('timeout');
    expect(err.service).toBe('engine');
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(504);
    expect(err.upstreamStatus).toBeUndefined();
  });

  it('stores upstreamStatus when provided', () => {
    const err = new ServiceError('Bad gateway', {
      code: 'upstream',
      service: 'agents',
      retryable: false,
      status: 502,
      upstreamStatus: 500,
    });

    expect(err.upstreamStatus).toBe(500);
  });

  it('is an instance of Error', () => {
    const err = new ServiceError('fail', {
      code: 'network',
      service: 'engine',
      retryable: false,
      status: 503,
    });
    expect(err).toBeInstanceOf(Error);
  });

  it('handles all error codes', () => {
    const codes = [
      'not_configured',
      'timeout',
      'network',
      'upstream',
      'aborted',
      'unknown',
    ] as const;
    for (const code of codes) {
      const err = new ServiceError('test', {
        code,
        service: 'engine',
        retryable: false,
        status: 500,
      });
      expect(err.code).toBe(code);
    }
  });

  it('handles both service names', () => {
    const engine = new ServiceError('e', {
      code: 'timeout',
      service: 'engine',
      retryable: true,
      status: 504,
    });
    const agents = new ServiceError('a', {
      code: 'timeout',
      service: 'agents',
      retryable: true,
      status: 504,
    });
    expect(engine.service).toBe('engine');
    expect(agents.service).toBe('agents');
  });
});

// ---------------------------------------------------------------------------
// extractErrorMessage
// ---------------------------------------------------------------------------

describe('extractErrorMessage', () => {
  it('returns fallback for null', () => {
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined', () => {
    expect(extractErrorMessage(undefined, 'default error')).toBe('default error');
  });

  it('returns fallback for empty string', () => {
    expect(extractErrorMessage('', 'fallback')).toBe('fallback');
  });

  it('returns fallback for whitespace-only string', () => {
    expect(extractErrorMessage('   ', 'fallback')).toBe('fallback');
  });

  it('returns the string itself when non-empty', () => {
    expect(extractErrorMessage('rate limit exceeded', 'fallback')).toBe('rate limit exceeded');
  });

  it('extracts "error" key from object', () => {
    expect(extractErrorMessage({ error: 'not found' }, 'fallback')).toBe('not found');
  });

  it('extracts "detail" key from object', () => {
    expect(extractErrorMessage({ detail: 'validation failed' }, 'fallback')).toBe(
      'validation failed',
    );
  });

  it('extracts "message" key from object', () => {
    expect(extractErrorMessage({ message: 'unauthorized' }, 'fallback')).toBe('unauthorized');
  });

  it('prefers "error" over "detail" and "message"', () => {
    expect(
      extractErrorMessage(
        { error: 'primary', detail: 'secondary', message: 'tertiary' },
        'fallback',
      ),
    ).toBe('primary');
  });

  it('falls back to "detail" when "error" is empty', () => {
    expect(extractErrorMessage({ error: '', detail: 'detail message' }, 'fallback')).toBe(
      'detail message',
    );
  });

  it('returns fallback when all object keys are empty', () => {
    expect(extractErrorMessage({ error: '', detail: '', message: '' }, 'fallback')).toBe(
      'fallback',
    );
  });

  it('returns fallback for numeric value', () => {
    expect(extractErrorMessage(42, 'fallback')).toBe('fallback');
  });

  it('returns fallback for empty object', () => {
    expect(extractErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

// ---------------------------------------------------------------------------
// serializeServiceError
// ---------------------------------------------------------------------------

describe('serializeServiceError', () => {
  it('serializes ServiceError to plain body object', () => {
    const err = new ServiceError('Engine timed out', {
      code: 'timeout',
      service: 'engine',
      retryable: true,
      status: 504,
    });

    const body: ServiceErrorBody = serializeServiceError(err);

    expect(body.error).toBe('Engine timed out');
    expect(body.code).toBe('timeout');
    expect(body.service).toBe('engine');
    expect(body.retryable).toBe(true);
    expect(body.status).toBe(504);
  });

  it('does not include upstreamStatus in serialized form', () => {
    const err = new ServiceError('Bad gateway', {
      code: 'upstream',
      service: 'agents',
      retryable: false,
      status: 502,
      upstreamStatus: 500,
    });

    const body = serializeServiceError(err);
    expect('upstreamStatus' in body).toBe(false);
  });

  it('produces a plain object (not a class instance)', () => {
    const err = new ServiceError('fail', {
      code: 'unknown',
      service: 'engine',
      retryable: false,
      status: 500,
    });

    const body = serializeServiceError(err);
    expect(Object.getPrototypeOf(body)).toBe(Object.prototype);
  });
});
