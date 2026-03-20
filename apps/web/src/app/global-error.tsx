'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-xl rounded-xl border border-loss/30 bg-loss/5 p-6">
          <div className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-5 w-5 text-loss" />
            Sentinel could not recover
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            A global application error interrupted rendering. Retry the app shell before attempting
            any trading action.
          </p>
          <button
            onClick={reset}
            className="mt-4 inline-flex items-center rounded-md bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="ml-1.5">Retry App</span>
          </button>
        </div>
      </body>
    </html>
  );
}
