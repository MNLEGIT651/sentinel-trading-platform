/**
 * Shared environment contract for the agents service.
 *
 * Keep the required variable list in one place so boot-time validation and
 * tests cannot drift from the runtime assumptions used by the server/auth code.
 */

export const REQUIRED_AGENT_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'ENGINE_URL',
  'ENGINE_API_KEY',
] as const;

export const AGENTS_ENV_GUIDANCE =
  'Copy .env.example to .env and fill in all required values before starting.';

export function getMissingAgentEnvVars(
  env: NodeJS.ProcessEnv = process.env,
): Array<(typeof REQUIRED_AGENT_ENV_VARS)[number]> {
  return REQUIRED_AGENT_ENV_VARS.filter((key) => !env[key]);
}

export function formatMissingAgentEnvMessage(
  missing: ReadonlyArray<string>,
): string {
  return `Missing required environment variables: ${missing.join(', ')}. See .env.example for guidance.`;
}
