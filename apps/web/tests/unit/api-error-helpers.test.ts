import { describe, expect, it } from 'vitest';
import {
  safeErrorMessage,
  apiError,
  badRequest,
  notFound,
  conflict,
  dbError,
  safeParseBody,
} from '@/lib/api-error';

// ─── safeErrorMessage ───────────────────────────────────────────────

describe('safeErrorMessage', () => {
  it('returns message when not leaky', () => {
    expect(safeErrorMessage({ message: 'Something went wrong' }, 'fallback')).toBe(
      'Something went wrong',
    );
  });

  it('returns fallback for column leak', () => {
    expect(safeErrorMessage({ message: 'column "secret_col" does not exist' }, 'Bad query')).toBe(
      'Bad query',
    );
  });

  it('returns fallback for relation leak', () => {
    expect(
      safeErrorMessage({ message: 'relation "internal_table" does not exist' }, 'Bad query'),
    ).toBe('Bad query');
  });

  it('returns fallback for schema cache leak', () => {
    expect(safeErrorMessage({ message: 'schema cache lookup failed' }, 'Server error')).toBe(
      'Server error',
    );
  });

  it('returns fallback for constraint violation leak', () => {
    expect(
      safeErrorMessage({ message: 'violates unique constraint "users_email_key"' }, 'Duplicate'),
    ).toBe('Duplicate');
  });

  it('returns fallback for duplicate key leak', () => {
    expect(
      safeErrorMessage({ message: 'duplicate key value violates unique constraint' }, 'Dup'),
    ).toBe('Dup');
  });

  it('returns fallback for "Could not find" leak', () => {
    expect(safeErrorMessage({ message: 'Could not find resource' }, 'Not found')).toBe('Not found');
  });

  it('returns fallback when message is empty', () => {
    expect(safeErrorMessage({ message: '' }, 'fallback')).toBe('fallback');
  });

  it('returns fallback when error has no message', () => {
    expect(safeErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

// ─── apiError ───────────────────────────────────────────────────────

describe('apiError', () => {
  it('returns structured JSON with correct status', async () => {
    const res = apiError(422, 'validation_error', 'Name is required');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toEqual({ error: 'validation_error', message: 'Name is required' });
  });

  it('uses error as message when message is omitted', async () => {
    const res = apiError(500, 'server_error');
    const body = await res.json();
    expect(body.message).toBe('server_error');
  });
});

// ─── convenience helpers ────────────────────────────────────────────

describe('badRequest', () => {
  it('returns 400 with bad_request error code', async () => {
    const res = badRequest('Missing field');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('bad_request');
    expect(body.message).toBe('Missing field');
  });
});

describe('notFound', () => {
  it('returns 404 with default message', async () => {
    const res = notFound();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    expect(body.message).toBe('Resource not found');
  });

  it('returns 404 with custom message', async () => {
    const res = notFound('Thread not found');
    const body = await res.json();
    expect(body.message).toBe('Thread not found');
  });
});

describe('conflict', () => {
  it('returns 409', async () => {
    const res = conflict('Version conflict');
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('conflict');
  });
});

describe('dbError', () => {
  it('sanitizes leaky DB errors', async () => {
    const res = dbError(
      { message: 'relation "advisor_preferences" does not exist' },
      'Query failed',
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Query failed');
    expect(body.message).not.toContain('advisor_preferences');
  });

  it('passes safe messages through', async () => {
    const res = dbError({ message: 'Connection timeout' }, 'Query failed');
    const body = await res.json();
    expect(body.message).toBe('Connection timeout');
  });
});

// ─── safeParseBody ──────────────────────────────────────────────────

describe('safeParseBody', () => {
  it('parses valid JSON body', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
      headers: { 'content-type': 'application/json' },
    });
    const result = await safeParseBody<{ name: string }>(req);
    expect(result).toEqual({ name: 'test' });
  });

  it('returns null for invalid JSON', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const result = await safeParseBody(req);
    expect(result).toBeNull();
  });

  it('returns null for empty body', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const result = await safeParseBody(req);
    expect(result).toBeNull();
  });
});
