import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxyServiceRequest } from '@/lib/server/service-proxy';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  ENGINE_URL: process.env.ENGINE_URL,
  ENGINE_API_KEY: process.env.ENGINE_API_KEY,
  AGENTS_URL: process.env.AGENTS_URL,
};

function restoreEnv() {
  (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv.NODE_ENV;
  process.env.ENGINE_URL = originalEnv.ENGINE_URL;
  process.env.ENGINE_API_KEY = originalEnv.ENGINE_API_KEY;
  process.env.AGENTS_URL = originalEnv.AGENTS_URL;
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe('proxyServiceRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns 503 when the agents service is not configured in production', async () => {
    setNodeEnv('production');
    delete process.env.AGENTS_URL;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await proxyServiceRequest(
      'agents',
      new Request('https://sentinel.example/api/agents/health'),
      ['health'],
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('not_configured');
    expect(body.service).toBe('agents');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('returns 503 when the engine API key is missing in production', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    delete process.env.ENGINE_API_KEY;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await proxyServiceRequest(
      'engine',
      new Request('https://sentinel.example/api/engine/health'),
      ['health'],
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('not_configured');
    expect(body.service).toBe('engine');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('retries retryable GET failures and injects server-side auth headers', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyServiceRequest(
      'engine',
      new Request('https://sentinel.example/api/engine/api/v1/strategies/'),
      ['api', 'v1', 'strategies'],
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer secret-key');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('does not retry non-idempotent POST requests and returns a timeout payload', async () => {
    setNodeEnv('production');
    process.env.ENGINE_URL = 'https://engine.example';
    process.env.ENGINE_API_KEY = 'secret-key';

    const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyServiceRequest(
      'engine',
      new Request('https://sentinel.example/api/engine/api/v1/strategies/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: ['AAPL'] }),
      }),
      ['api', 'v1', 'strategies', 'scan'],
    );
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(504);
    expect(body.code).toBe('timeout');
    expect(body.retryable).toBe(false);
  });
});
