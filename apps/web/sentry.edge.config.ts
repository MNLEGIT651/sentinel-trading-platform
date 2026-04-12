// Sentry edge runtime configuration for @sentinel/web
// This file configures the initialization of Sentry for edge features (middleware, edge routes).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://42c1720e190b9554fb0427f182ae3698@o4511207349747712.ingest.us.sentry.io/4511207351713792',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: 0.1,
});
