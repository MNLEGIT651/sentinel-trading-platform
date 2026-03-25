'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route boundary error', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-xl border-loss/30 bg-loss/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <AlertTriangle className="h-5 w-5 text-loss" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sentinel hit an unexpected application error. You can retry this route without leaving
            the dashboard.
          </p>
          <Button onClick={reset} size="sm">
            <RefreshCw className="h-4 w-4" />
            <span className="ml-1.5">Retry</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
