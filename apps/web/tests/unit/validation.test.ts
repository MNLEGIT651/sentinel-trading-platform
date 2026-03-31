import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody, parseSearchParams, uuidParam, paginationQuery } from '@/lib/api/validation';

describe('parseBody', () => {
  const Schema = z.object({
    name: z.string().min(1, 'name is required'),
    count: z.number().int().min(0).optional(),
  });

  it('returns parsed data for valid JSON', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'foo', count: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseBody(req, Schema);
    expect(result).toEqual({ name: 'foo', count: 5 });
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseBody(req, Schema);
    expect(result).toBeInstanceOf(NextResponse);
    const resp = result as NextResponse;
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('bad_request');
  });

  it('returns 400 with validation issues for schema mismatch', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: '', count: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseBody(req, Schema);
    expect(result).toBeInstanceOf(NextResponse);
    const resp = result as NextResponse;
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('validation_error');
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('returns 400 when required field is missing', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ count: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseBody(req, Schema);
    expect(result).toBeInstanceOf(NextResponse);
    const resp = result as NextResponse;
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('validation_error');
    expect(body.issues.some((i: { path: string }) => i.path === 'name')).toBe(true);
  });

  it('strips extra fields by default', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'foo', extra: 'bar' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseBody(req, Schema);
    expect(result).toEqual({ name: 'foo' });
  });
});

describe('parseSearchParams', () => {
  const Schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    status: z.enum(['active', 'inactive']).optional(),
  });

  it('returns parsed data for valid params', () => {
    const req = new Request('http://localhost/api/test?limit=10&status=active');
    const result = parseSearchParams(req, Schema);
    expect(result).toEqual({ limit: 10, status: 'active' });
  });

  it('applies defaults for missing params', () => {
    const req = new Request('http://localhost/api/test');
    const result = parseSearchParams(req, Schema);
    expect(result).toEqual({ limit: 50 });
  });

  it('returns 400 for invalid enum value', () => {
    const req = new Request('http://localhost/api/test?status=invalid');
    const result = parseSearchParams(req, Schema);
    expect(result).toBeInstanceOf(NextResponse);
    const resp = result as NextResponse;
    expect(resp.status).toBe(400);
  });

  it('coerces string numbers', () => {
    const req = new Request('http://localhost/api/test?limit=25');
    const result = parseSearchParams(req, Schema);
    expect(result).toEqual({ limit: 25 });
  });
});

describe('shared schemas', () => {
  it('uuidParam validates UUIDs', () => {
    expect(uuidParam.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
    expect(uuidParam.safeParse('not-a-uuid').success).toBe(false);
    expect(uuidParam.safeParse('').success).toBe(false);
  });

  it('paginationQuery has correct defaults', () => {
    const result = paginationQuery.parse({});
    expect(result).toEqual({ limit: 50, offset: 0 });
  });

  it('paginationQuery enforces bounds', () => {
    expect(paginationQuery.safeParse({ limit: '0' }).success).toBe(false);
    expect(paginationQuery.safeParse({ limit: '101' }).success).toBe(false);
    expect(paginationQuery.safeParse({ offset: '-1' }).success).toBe(false);
  });
});
