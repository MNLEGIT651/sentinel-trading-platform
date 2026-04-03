'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Orders] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Orders error"
      message="Failed to load order history. Your orders are safe — try again."
      onRetry={reset}
    />
  );
}
