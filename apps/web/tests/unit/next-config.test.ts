import { describe, it, expect } from 'vitest';
import nextConfig from '@/../next.config';

describe('next.config security headers', () => {
  it('includes a Content-Security-Policy header', async () => {
    const headers = await nextConfig.headers?.();
    const allHeaders = headers?.flatMap((h) => h.headers) ?? [];
    const csp = allHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp?.value).toContain("default-src 'self'");
  });

  it('CSP includes Supabase websocket origin for Realtime', async () => {
    const headers = await nextConfig.headers?.();
    const allHeaders = headers?.flatMap((h) => h.headers) ?? [];
    const csp = allHeaders.find((h) => h.key === 'Content-Security-Policy');
    expect(csp?.value).toContain('wss://*.supabase.co');
  });
});
