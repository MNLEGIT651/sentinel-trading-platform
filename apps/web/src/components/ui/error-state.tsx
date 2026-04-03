'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RotateCcw, type LucideIcon } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: LucideIcon;
  variant?: 'inline' | 'full-page';
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  icon: Icon = AlertTriangle,
  variant = 'inline',
  className,
}: ErrorStateProps) {
  const isFullPage = variant === 'full-page';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'animate-sentinel-in',
        isFullPage && 'flex min-h-[60vh] items-center justify-center p-6',
        className,
      )}
    >
      <Card className={cn('border-loss/30 bg-loss/5', isFullPage && 'w-full max-w-md')}>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-loss/10">
            <Icon className="h-6 w-6 text-loss" />
          </div>
          <div className="space-y-1 text-center">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
