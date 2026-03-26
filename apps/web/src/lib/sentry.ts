/**
 * Sentry integration stub.
 * When SENTRY_DSN is set and @sentry/nextjs is installed, this will
 * initialise Sentry. Otherwise it's a no-op.
 */
export function initSentry(): void {
  if (!process.env.SENTRY_DSN) return;

  // Dynamic import so @sentry/nextjs is optional
  import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      });
    })
    .catch(() => {
      // @sentry/nextjs not installed — skip silently
    });
}
