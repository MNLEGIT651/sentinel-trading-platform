'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Settings] Unhandled error:', error);
  }, [error]);

  return (
    <ErrorState
      variant="full-page"
      title="Settings error"
      message="Failed to load settings. Your configuration is safe — try again."
      onRetry={reset}
    />
  );
}
