import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/settings/system-info/route';

describe('/api/settings/system-info', () => {
  it('returns platform metadata from server source of truth', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      platform: 'Sentinel Trading',
      engine: 'FastAPI (Python 3.12)',
      database: 'Supabase (PostgreSQL 17)',
    });
    expect(typeof body.appVersion).toBe('string');
    expect(body.appVersion.length).toBeGreaterThan(0);
  });
});
