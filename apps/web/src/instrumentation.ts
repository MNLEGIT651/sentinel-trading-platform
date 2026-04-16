import { validateEnv } from '@/lib/env';

export function register() {
  const result = validateEnv();
  if (
    !result.valid &&
    (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')
  ) {
    throw new Error(
      `Production startup blocked due to missing required environment: ${result.missing.join(', ')}`,
    );
  }
}
