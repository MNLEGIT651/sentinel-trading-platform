'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function BacktestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Backtest] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Backtest error"
      message="Failed to load backtest results. Your data is preserved — try again."
      onRetry={reset}
    />
  );
}
