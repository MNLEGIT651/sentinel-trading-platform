'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function MarketsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Markets] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Markets error"
      message="Failed to load market data. This may be a connectivity issue — try again."
      onRetry={reset}
    />
  );
}
