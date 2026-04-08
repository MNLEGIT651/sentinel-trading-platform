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

  // =========================================================================
  // T-C02: Body size limit (413)
  // =========================================================================
  describe('body size limit (413)', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    it('rejects POST bodies larger than 1 MiB with 413', async () => {
      setupEngine();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const oversizedBody = new Uint8Array(1_048_576 + 1); // 1 byte over limit
      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/orders', {
          method: 'POST',
          body: oversizedBody,
        }),
        ['orders'],
      );
      const body = await response.json();

      expect(response.status).toBe(413);
      expect(body.code).toBe('upstream');
      expect(body.retryable).toBe(false);
      expect(body.error).toContain('1024KiB limit');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('allows POST bodies exactly at the 1 MiB limit', async () => {
      setupEngine();
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const exactBody = new Uint8Array(1_048_576); // exactly 1 MiB
      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/orders', {
          method: 'POST',
          body: exactBody,
        }),
        ['orders'],
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('rejects PUT bodies exceeding the limit', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const oversized = new Uint8Array(1_048_577);
      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/settings', {
          method: 'PUT',
          body: oversized,
        }),
        ['settings'],
      );

      expect(response.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not enforce body limit for GET requests', async () => {
      setupEngine();
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/health'),
        ['health'],
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // T-C02: Retry exhaustion
  // =========================================================================
  describe('retry exhaustion', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    it('retries retryable GET 503 and returns error after all attempts exhausted', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'overloaded' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'still down' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      // Use a path that gets 2 attempts for GET (default idempotent behavior)
      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
        ['api', 'v1', 'data', 'quotes'],
      );
      const body = await response.json();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(502); // 503 upstream → 502 mapped
      expect(body.code).toBe('upstream');
      expect(body.retryable).toBe(true);
    });

    it('succeeds on second attempt after first retryable failure', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'overloaded' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
        ['api', 'v1', 'data', 'quotes'],
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('does not retry non-retryable POST even on 503', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        }),
        ['api', 'v1', 'backtest', 'run'],
      );
      const body = await response.json();

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(response.status).toBe(502); // 503 → 502
      expect(body.retryable).toBe(false);
    });

    it('retries network TypeError for GET and fails after exhaustion', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed again'));
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
        ['api', 'v1', 'data', 'quotes'],
      );
      const body = await response.json();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(502);
      expect(body.code).toBe('network');
    });
  });

  // =========================================================================
  // T-C02: Retryable vs non-retryable upstream statuses
  // =========================================================================
  describe('retryable vs non-retryable upstream statuses', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const nonRetryableStatuses = [400, 401, 403, 404, 409, 422];

    for (const status of retryableStatuses) {
      it(`marks upstream ${status} as retryable for GET`, async () => {
        setupEngine();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'fail' }), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'fail again' }), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        vi.stubGlobal('fetch', fetchMock);

        const response = await proxyServiceRequest(
          'engine',
          new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
          ['api', 'v1', 'data', 'quotes'],
        );
        const body = await response.json();

        expect(body.retryable).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2); // retried
      });
    }

    for (const status of nonRetryableStatuses) {
      it(`marks upstream ${status} as non-retryable for GET (no retry)`, async () => {
        setupEngine();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchMock = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: 'client error' }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const response = await proxyServiceRequest(
          'engine',
          new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
          ['api', 'v1', 'data', 'quotes'],
        );
        const body = await response.json();

        expect(body.retryable).toBe(false);
        expect(fetchMock).toHaveBeenCalledOnce(); // no retry
      });
    }

    it('marks retryable statuses as non-retryable for POST', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
      );
      const body = await response.json();

      expect(body.retryable).toBe(false);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // T-C02: Upstream status code mapping
  // =========================================================================
  describe('upstream status mapping', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    const mappings: Array<[number, number, string]> = [
      [404, 404, 'passes through 404'],
      [429, 503, 'maps rate-limit 429 to 503'],
      [500, 502, 'maps 500 to 502'],
      [502, 502, 'maps 502 to 502'],
      [503, 502, 'maps 503 to 502'],
      [504, 502, 'maps 504 to 502'],
      [401, 401, 'passes through auth 401'],
      [403, 403, 'passes through forbidden 403'],
      [400, 400, 'passes through client 400'],
      [409, 409, 'passes through conflict 409'],
      [422, 422, 'passes through unprocessable 422'],
    ];

    for (const [upstream, expected, label] of mappings) {
      it(`${label} (${upstream} → ${expected})`, async () => {
        setupEngine();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Use POST to avoid retry noise; single-attempt guarantees one fetch call
        const fetchMock = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: 'test' }), {
            status: upstream,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const response = await proxyServiceRequest(
          'engine',
          new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
          ['api', 'v1', 'backtest', 'run'],
        );

        expect(response.status).toBe(expected);
      });
    }
  });

  // =========================================================================
  // T-C02: Timeout handling
  // =========================================================================
  describe('timeout handling', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    it('returns 504 with timeout code on GET timeout', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
        ['api', 'v1', 'data', 'quotes'],
      );
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.code).toBe('timeout');
      expect(body.retryable).toBe(true); // GET is retryable on timeout
    });

    it('marks timeout as non-retryable for POST', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
      );
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.code).toBe('timeout');
      expect(body.retryable).toBe(false);
    });

    it('retries GET timeout and succeeds on second attempt', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
        ['api', 'v1', 'data', 'quotes'],
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // T-C02: Abort handling
  // =========================================================================
  describe('abort handling', () => {
    it('returns 499 with aborted code when client aborts', async () => {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/data/quotes'),
        ['api', 'v1', 'data', 'quotes'],
      );
      const body = await response.json();

      expect(response.status).toBe(499);
      expect(body.code).toBe('aborted');
      expect(body.retryable).toBe(false);
    });
  });

  // =========================================================================
  // T-C02: Response header filtering
  // =========================================================================
  describe('response header filtering', () => {
    it('forwards allowed headers and strips internal ones', async () => {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Correlation-Id': 'abc-123',
            'X-Internal-Secret': 'should-be-stripped',
            'Set-Cookie': 'should-be-stripped',
          },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/health'),
        ['health'],
      );

      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('x-correlation-id')).toBe('abc-123');
      expect(response.headers.get('x-internal-secret')).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull();
    });
  });

  // =========================================================================
  // T-C02: Upstream error message extraction
  // =========================================================================
  describe('upstream error message extraction', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    it('extracts error from JSON { error: "..." } response', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Quota exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
      );
      const body = await response.json();
      expect(body.error).toBe('Quota exceeded');
    });

    it('extracts error from JSON { message: "..." } response', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Internal failure' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
      );
      const body = await response.json();
      expect(body.error).toBe('Internal failure');
    });

    it('uses fallback message when upstream returns empty JSON', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
      );
      const body = await response.json();
      expect(body.error).toContain('quant engine returned 500');
    });
  });

  // =========================================================================
  // T-F01: Correlation ID in error responses
  // =========================================================================
  describe('correlation ID in error responses', () => {
    function setupEngine() {
      setNodeEnv('production');
      process.env.ENGINE_URL = 'https://engine.example';
      process.env.ENGINE_API_KEY = 'secret-key';
    }

    it('includes correlationId in error response body when provided via extraHeaders', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
        { 'x-correlation-id': 'test-corr-123' },
      );
      const body = await response.json();

      expect(body.correlationId).toBe('test-corr-123');
      expect(response.headers.get('x-correlation-id')).toBe('test-corr-123');
    });

    it('includes x-correlation-id header on error responses', async () => {
      setupEngine();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
      vi.stubGlobal('fetch', fetchMock);

      const response = await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
        { 'x-correlation-id': 'timeout-corr-456' },
      );

      expect(response.headers.get('x-correlation-id')).toBe('timeout-corr-456');
      const body = await response.json();
      expect(body.correlationId).toBe('timeout-corr-456');
      expect(body.code).toBe('timeout');
    });

    it('omits correlationId field from body when no extraHeaders provided', async () => {
      setNodeEnv('production');
      delete process.env.AGENTS_URL;
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await proxyServiceRequest(
        'agents',
        new Request('https://sentinel.example/api/agents/health'),
        ['health'],
      );
      const body = await response.json();

      expect(body.correlationId).toBeUndefined();
      expect(response.headers.get('x-correlation-id')).toBeNull();
    });

    it('includes correlationId in structured failure logs', async () => {
      setupEngine();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/api/v1/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        ['api', 'v1', 'backtest', 'run'],
        { 'x-correlation-id': 'log-corr-789' },
      );

      expect(consoleError).toHaveBeenCalled();
      const logCall = consoleError.mock.calls[0]![0] as string;
      const logData = JSON.parse(logCall);
      expect(logData.correlationId).toBe('log-corr-789');
      expect(logData.scope).toBe('service-proxy');
    });

    it('includes correlationId in structured success logs', async () => {
      setupEngine();
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await proxyServiceRequest(
        'engine',
        new Request('https://sentinel.example/api/engine/health'),
        ['health'],
        { 'x-correlation-id': 'success-corr-abc' },
      );

      expect(consoleLog).toHaveBeenCalled();
      const logCall = consoleLog.mock.calls[0]![0] as string;
      const logData = JSON.parse(logCall);
      expect(logData.correlationId).toBe('success-corr-abc');
      expect(logData.action).toBe('success');
    });
  });
});
