import { describe, expect, it } from 'vitest';
import { engineHeaders, engineUrl } from '@/lib/engine-fetch';

describe('engine-fetch', () => {
  it('routes engine calls through the same-origin proxy', () => {
    expect(engineUrl('/api/v1/portfolio/account')).toBe('/api/engine/api/v1/portfolio/account');
  });

  it('does not expose engine auth headers to the browser', () => {
    expect(engineHeaders()).toEqual({});
  });
});
