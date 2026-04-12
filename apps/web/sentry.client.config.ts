// Sentry client-side configuration for @sentinel/web
// Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://42c1720e190b9554fb0427f182ae3698@o4511207349747712.ingest.us.sentry.io/4511207351713792',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // --- Performance Monitoring ---
  tracesSampleRate: 0.1,

  // --- Session Replay ---
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],

  // --- Noise Reduction ---
  ignoreErrors: [
    'ResizeObserver loop',
    'Network request failed',
    /Loading chunk \d+ failed/,
    /^Script error\.?$/,
  ],
});
