import { describe, expect, it } from 'vitest';
import {
  REQUIRED_AGENT_ENV_VARS,
  formatMissingAgentEnvMessage,
  getMissingAgentEnvVars,
} from '../src/env.js';

describe('agents env contract', () => {
  it('includes SUPABASE_JWT_SECRET in the required env list', () => {
    expect(REQUIRED_AGENT_ENV_VARS).toContain('SUPABASE_JWT_SECRET');
  });

  it('reports SUPABASE_JWT_SECRET when it is the only missing variable', () => {
    const missing = getMissingAgentEnvVars({
      ANTHROPIC_API_KEY: 'a',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      ENGINE_URL: 'http://localhost:8000',
      ENGINE_API_KEY: 'engine-key',
      WEB_URL: 'http://localhost:3000',
    });

    expect(missing).toEqual(['SUPABASE_JWT_SECRET']);
    expect(formatMissingAgentEnvMessage(missing)).toContain('SUPABASE_JWT_SECRET');
  });

  it('passes when all required env vars are present', () => {
    const missing = getMissingAgentEnvVars({
      ANTHROPIC_API_KEY: 'a',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_JWT_SECRET: 'jwt-secret',
      ENGINE_URL: 'http://localhost:8000',
      ENGINE_API_KEY: 'engine-key',
      WEB_URL: 'http://localhost:3000',
    });

    expect(missing).toEqual([]);
  });
});
