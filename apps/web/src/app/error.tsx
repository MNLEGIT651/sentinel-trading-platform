'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-xl rounded-xl border border-loss/30 bg-loss/5 p-6">
        <div className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-5 w-5 text-loss" />
          Something went wrong
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          An error occurred while loading this page. Your data is safe — retry or navigate back to
          the dashboard.
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center rounded-md bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="ml-1.5">Try again</span>
        </button>
      </div>
    </div>
  );
}
