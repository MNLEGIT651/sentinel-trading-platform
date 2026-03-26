/**
 * Unit tests for service-error utilities.
 *
 * Tests ServiceError class, extractErrorMessage, and serializeServiceError
 * to ensure error handling is consistent across service proxy calls.
 */

import { describe, it, expect } from 'vitest';
import {
  ServiceError,
  extractErrorMessage,
  serializeServiceError,
  type ServiceErrorCode,
} from '@/lib/service-error';

describe('ServiceError', () => {
  it('creates error with all required properties', () => {
    const error = new ServiceError('Engine timeout', {
      code: 'timeout',
      service: 'engine',
      retryable: true,
      status: 504,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.name).toBe('ServiceError');
    expect(error.message).toBe('Engine timeout');
    expect(error.code).toBe('timeout');
    expect(error.service).toBe('engine');
    expect(error.retryable).toBe(true);
    expect(error.status).toBe(504);
    expect(error.upstreamStatus).toBeUndefined();
  });

  it('includes optional upstreamStatus when provided', () => {
    const error = new ServiceError('Upstream error', {
      code: 'upstream',
      service: 'agents',
      retryable: false,
      status: 502,
      upstreamStatus: 500,
    });

    expect(error.upstreamStatus).toBe(500);
  });

  it('supports all service error codes', () => {
    const codes: ServiceErrorCode[] = [
      'not_configured',
      'timeout',
      'network',
      'upstream',
      'aborted',
      'unknown',
    ];

    codes.forEach((code) => {
      const error = new ServiceError(`Test ${code}`, {
        code,
        service: 'engine',
        retryable: true,
        status: 500,
      });
      expect(error.code).toBe(code);
    });
  });

  it('supports both engine and agents services', () => {
    const engineError = new ServiceError('Engine error', {
      code: 'network',
      service: 'engine',
      retryable: true,
      status: 503,
    });
    expect(engineError.service).toBe('engine');

    const agentsError = new ServiceError('Agents error', {
      code: 'network',
      service: 'agents',
      retryable: true,
      status: 503,
    });
    expect(agentsError.service).toBe('agents');
  });
});

describe('extractErrorMessage', () => {
  it('returns the fallback when payload is null or undefined', () => {
    expect(extractErrorMessage(null, 'default')).toBe('default');
    expect(extractErrorMessage(undefined, 'default')).toBe('default');
  });

  it('returns the fallback when payload is an empty string', () => {
    expect(extractErrorMessage('', 'default')).toBe('default');
    expect(extractErrorMessage('   ', 'default')).toBe('default');
  });

  it('returns the string payload when it is non-empty', () => {
    expect(extractErrorMessage('Custom error message', 'default')).toBe('Custom error message');
    expect(extractErrorMessage('  Error with whitespace  ', 'default')).toBe(
      '  Error with whitespace  ',
    );
  });

  it('extracts error field from object payload', () => {
    const payload = { error: 'Authentication failed' };
    expect(extractErrorMessage(payload, 'default')).toBe('Authentication failed');
  });

  it('extracts detail field from object payload when error is missing', () => {
    const payload = { detail: 'Resource not found' };
    expect(extractErrorMessage(payload, 'default')).toBe('Resource not found');
  });

  it('extracts message field from object payload when error and detail are missing', () => {
    const payload = { message: 'Something went wrong' };
    expect(extractErrorMessage(payload, 'default')).toBe('Something went wrong');
  });

  it('prioritizes error > detail > message in extraction order', () => {
    const payload = {
      error: 'Primary error',
      detail: 'Detailed info',
      message: 'Generic message',
    };
    expect(extractErrorMessage(payload, 'default')).toBe('Primary error');
  });

  it('returns fallback when object has no error/detail/message fields', () => {
    const payload = { code: 500, status: 'failed' };
    expect(extractErrorMessage(payload, 'default')).toBe('default');
  });

  it('returns fallback when error/detail/message fields are empty strings', () => {
    const payload = { error: '', detail: '  ', message: '' };
    expect(extractErrorMessage(payload, 'default')).toBe('default');
  });

  it('handles nested objects gracefully (returns fallback)', () => {
    const payload = { nested: { error: 'Nested error' } };
    expect(extractErrorMessage(payload, 'default')).toBe('default');
  });

  it('handles non-string error/detail/message fields (returns fallback)', () => {
    const payload = { error: 123, detail: false, message: null };
    expect(extractErrorMessage(payload, 'default')).toBe('default');
  });

  it('handles arrays as payload (returns fallback)', () => {
    const payload = ['error 1', 'error 2'];
    expect(extractErrorMessage(payload, 'default')).toBe('default');
  });

  it('handles numbers and booleans as payload (returns fallback)', () => {
    expect(extractErrorMessage(42, 'default')).toBe('default');
    expect(extractErrorMessage(true, 'default')).toBe('default');
    expect(extractErrorMessage(false, 'default')).toBe('default');
  });
});

describe('serializeServiceError', () => {
  it('serializes all ServiceError properties to ServiceErrorBody', () => {
    const error = new ServiceError('Network timeout occurred', {
      code: 'timeout',
      service: 'engine',
      retryable: true,
      status: 504,
    });

    const body = serializeServiceError(error);

    expect(body).toEqual({
      error: 'Network timeout occurred',
      code: 'timeout',
      service: 'engine',
      retryable: true,
      status: 504,
    });
  });

  it('does not include upstreamStatus in serialized body', () => {
    const error = new ServiceError('Upstream failure', {
      code: 'upstream',
      service: 'agents',
      retryable: false,
      status: 502,
      upstreamStatus: 500,
    });

    const body = serializeServiceError(error);

    expect(body).not.toHaveProperty('upstreamStatus');
    expect(body).toEqual({
      error: 'Upstream failure',
      code: 'upstream',
      service: 'agents',
      retryable: false,
      status: 502,
    });
  });

  it('serializes not_configured error correctly', () => {
    const error = new ServiceError('Service not configured', {
      code: 'not_configured',
      service: 'engine',
      retryable: false,
      status: 503,
    });

    const body = serializeServiceError(error);

    expect(body.code).toBe('not_configured');
    expect(body.retryable).toBe(false);
  });

  it('serializes network error correctly', () => {
    const error = new ServiceError('Network connection failed', {
      code: 'network',
      service: 'agents',
      retryable: true,
      status: 503,
    });

    const body = serializeServiceError(error);

    expect(body.code).toBe('network');
    expect(body.retryable).toBe(true);
  });

  it('serializes aborted error correctly', () => {
    const error = new ServiceError('Request was aborted', {
      code: 'aborted',
      service: 'engine',
      retryable: true,
      status: 499,
    });

    const body = serializeServiceError(error);

    expect(body.code).toBe('aborted');
    expect(body.status).toBe(499);
  });

  it('round-trip: create error, serialize, and verify structure', () => {
    const originalError = new ServiceError('Unknown error occurred', {
      code: 'unknown',
      service: 'engine',
      retryable: false,
      status: 500,
    });

    const serialized = serializeServiceError(originalError);

    // Verify serialized body can be sent over HTTP
    const jsonString = JSON.stringify(serialized);
    const parsed = JSON.parse(jsonString);

    expect(parsed).toEqual({
      error: 'Unknown error occurred',
      code: 'unknown',
      service: 'engine',
      retryable: false,
      status: 500,
    });
  });
});
