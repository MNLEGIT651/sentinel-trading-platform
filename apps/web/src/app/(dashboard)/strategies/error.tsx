'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function StrategiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Strategies] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Strategies error"
      message="Failed to load strategies. Your configurations are safe — try again."
      onRetry={reset}
    />
  );
}
