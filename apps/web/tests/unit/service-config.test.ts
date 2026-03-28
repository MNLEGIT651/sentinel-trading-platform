import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getServiceConfig,
  getServiceTimeoutMs,
  getServiceAttempts,
} from '@/lib/server/service-config';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  ENGINE_URL: process.env.ENGINE_URL,
  ENGINE_API_KEY: process.env.ENGINE_API_KEY,
  AGENTS_URL: process.env.AGENTS_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe('getServiceConfig', () => {
  beforeEach(() => restoreEnv());
  afterEach(() => restoreEnv());

  // ── Engine ──

  it('returns configured engine with valid env vars', () => {
    process.env.ENGINE_URL = 'https://engine.example.com';
    process.env.ENGINE_API_KEY = 'test-key';
    setNodeEnv('production');

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(true);
    expect(config.baseUrl).toBe('https://engine.example.com');
    expect(config.headers['Authorization']).toBe('Bearer test-key');
    expect(config.label).toBe('quant engine');
  });

  it('returns unconfigured engine when URL missing in production', () => {
    delete process.env.ENGINE_URL;
    setNodeEnv('production');

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(false);
    expect(config.baseUrl).toBeNull();
  });

  it('returns unconfigured engine when API key missing in production', () => {
    process.env.ENGINE_URL = 'https://engine.example.com';
    delete process.env.ENGINE_API_KEY;
    setNodeEnv('production');

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(false);
  });

  it('rejects localhost URLs in production', () => {
    process.env.ENGINE_URL = 'http://localhost:8000';
    process.env.ENGINE_API_KEY = 'test-key';
    setNodeEnv('production');

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(false);
    expect(config.baseUrl).toBeNull();
  });

  it('rejects 127.0.0.1 URLs in production', () => {
    process.env.ENGINE_URL = 'http://127.0.0.1:8000';
    process.env.ENGINE_API_KEY = 'test-key';
    setNodeEnv('production');

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(false);
  });

  it('allows localhost in development', () => {
    process.env.ENGINE_URL = 'http://localhost:8000';
    process.env.ENGINE_API_KEY = 'test-key';
    setNodeEnv('development');
    delete process.env.VERCEL;

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(true);
    expect(config.baseUrl).toBe('http://localhost:8000');
  });

  it('falls back to localhost defaults in development when env vars unset', () => {
    delete process.env.ENGINE_URL;
    delete process.env.ENGINE_API_KEY;
    setNodeEnv('development');
    delete process.env.VERCEL;

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(true);
    expect(config.baseUrl).toBe('http://localhost:8000');
  });

  it('strips trailing slashes from baseUrl', () => {
    process.env.ENGINE_URL = 'https://engine.example.com///';
    process.env.ENGINE_API_KEY = 'test-key';
    setNodeEnv('production');

    const config = getServiceConfig('engine');
    expect(config.baseUrl).toBe('https://engine.example.com');
  });

  it('treats VERCEL=1 as production runtime', () => {
    delete process.env.ENGINE_URL;
    process.env.VERCEL = '1';
    setNodeEnv('development');

    const config = getServiceConfig('engine');
    expect(config.configured).toBe(false);
  });

  // ── Agents ──

  it('returns configured agents with valid URL', () => {
    process.env.AGENTS_URL = 'https://agents.example.com';
    setNodeEnv('production');

    const config = getServiceConfig('agents');
    expect(config.configured).toBe(true);
    expect(config.baseUrl).toBe('https://agents.example.com');
    expect(config.headers).toEqual({});
    expect(config.label).toBe('agents service');
  });

  it('returns unconfigured agents when URL missing in production', () => {
    delete process.env.AGENTS_URL;
    setNodeEnv('production');

    const config = getServiceConfig('agents');
    expect(config.configured).toBe(false);
  });

  it('agents rejects localhost in production', () => {
    process.env.AGENTS_URL = 'http://localhost:3001';
    setNodeEnv('production');

    const config = getServiceConfig('agents');
    expect(config.configured).toBe(false);
  });
});

describe('getServiceTimeoutMs', () => {
  it('returns 4s for health checks', () => {
    expect(getServiceTimeoutMs('engine', '/health', 'GET')).toBe(4_000);
    expect(getServiceTimeoutMs('agents', '/health', 'GET')).toBe(4_000);
  });

  it('returns route-specific timeouts for engine', () => {
    expect(getServiceTimeoutMs('engine', '/api/v1/strategies/scan', 'POST')).toBe(70_000);
    expect(getServiceTimeoutMs('engine', '/api/v1/backtest/run', 'POST')).toBe(45_000);
    expect(getServiceTimeoutMs('engine', '/api/v1/data/quotes', 'GET')).toBe(15_000);
    expect(getServiceTimeoutMs('engine', '/api/v1/data/bars/AAPL', 'GET')).toBe(12_000);
    expect(getServiceTimeoutMs('engine', '/api/v1/portfolio/orders/history', 'GET')).toBe(10_000);
  });

  it('returns default engine timeouts by method', () => {
    expect(getServiceTimeoutMs('engine', '/api/v1/other', 'GET')).toBe(10_000);
    expect(getServiceTimeoutMs('engine', '/api/v1/other', 'POST')).toBe(15_000);
  });

  it('returns agents timeouts by method', () => {
    expect(getServiceTimeoutMs('agents', '/cycle', 'GET')).toBe(6_000);
    expect(getServiceTimeoutMs('agents', '/cycle', 'POST')).toBe(8_000);
  });

  it('is case-insensitive for path and method', () => {
    expect(getServiceTimeoutMs('engine', '/HEALTH', 'get')).toBe(4_000);
    expect(getServiceTimeoutMs('engine', '/API/V1/STRATEGIES/SCAN', 'post')).toBe(70_000);
  });
});

describe('getServiceAttempts', () => {
  it('returns 1 attempt for non-idempotent methods', () => {
    expect(getServiceAttempts('engine', '/api/v1/data/quotes', 'POST')).toBe(1);
    expect(getServiceAttempts('engine', '/api/v1/data/quotes', 'PUT')).toBe(1);
    expect(getServiceAttempts('engine', '/api/v1/data/quotes', 'DELETE')).toBe(1);
  });

  it('returns 1 attempt for health checks', () => {
    expect(getServiceAttempts('engine', '/health', 'GET')).toBe(1);
    expect(getServiceAttempts('agents', '/health', 'GET')).toBe(1);
  });

  it('returns 2 attempts for idempotent GET requests', () => {
    expect(getServiceAttempts('engine', '/api/v1/data/quotes', 'GET')).toBe(2);
    expect(getServiceAttempts('agents', '/status', 'GET')).toBe(2);
  });

  it('returns 2 attempts for HEAD requests', () => {
    expect(getServiceAttempts('engine', '/api/v1/data/quotes', 'HEAD')).toBe(2);
  });
});
