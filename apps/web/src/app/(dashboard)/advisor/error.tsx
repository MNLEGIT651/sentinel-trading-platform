'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function AdvisorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Advisor] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Advisor error"
      message="The advisor page encountered an error. This may be a temporary issue — try again."
      onRetry={reset}
    />
  );
}
