'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function SignalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Signals] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Signals error"
      message="Failed to load trading signals. Signal data may be temporarily unavailable — try again."
      onRetry={reset}
    />
  );
}
