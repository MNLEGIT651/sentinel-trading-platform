'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function JournalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Journal] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Journal error"
      message="Failed to load your trading journal. Your entries are safe — try again."
      onRetry={reset}
    />
  );
}
