import { describe, it, expect } from 'vitest';
import { EngineClient } from '@/lib/engine-client';

describe('EngineClient', () => {
  const client = new EngineClient('http://localhost:8000', 'test-key');

  it('constructs correct base URL', () => {
    expect(client.baseUrl).toBe('http://localhost:8000');
  });

  it('builds correct headers', () => {
    const h = client.getHeaders();
    expect(h['Authorization']).toBe('Bearer test-key');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('builds correct endpoint URLs', () => {
    expect(client.url('/data/ingest')).toBe(
      'http://localhost:8000/api/v1/data/ingest',
    );
    expect(client.url('/health')).toBe(
      'http://localhost:8000/api/v1/health',
    );
  });
});
