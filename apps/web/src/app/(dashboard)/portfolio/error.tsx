'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function PortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Portfolio] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Portfolio error"
      message="Failed to load your portfolio. Your positions and data are safe — try again."
      onRetry={reset}
    />
  );
}
