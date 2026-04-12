// Sentry server-side configuration for @sentinel/web
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://42c1720e190b9554fb0427f182ae3698@o4511207349747712.ingest.us.sentry.io/4511207351713792',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Performance: sample 10% of transactions
  tracesSampleRate: 0.1,
});
