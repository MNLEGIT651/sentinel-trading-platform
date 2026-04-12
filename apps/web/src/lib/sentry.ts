/**
 * Sentry integration helper.
 * Sentry is now configured via sentry.client.config.ts, sentry.server.config.ts,
 * and sentry.edge.config.ts at the project root. This function is kept for
 * backward-compatible call sites but is a no-op — initialization happens
 * automatically via the instrumentation hook.
 */
export function initSentry(): void {
  // Sentry is now initialized via instrumentation.ts and sentry.*.config.ts files.
  // This function is intentionally a no-op.
}
