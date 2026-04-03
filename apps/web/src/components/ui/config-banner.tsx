'use client';

import { Info, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ConfigBannerProps {
  message: string;
  linkHref?: string;
  linkLabel?: string;
  className?: string;
}

/**
 * Banner shown when a feature works but needs external configuration
 * (e.g., API keys) to provide real data instead of simulated/fallback.
 */
export function ConfigBanner({ message, linkHref, linkLabel, className }: ConfigBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300',
        className,
      )}
      role="status"
    >
      <Info className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {linkHref && (
        <Link
          href={linkHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-200 hover:text-amber-100 transition-colors"
        >
          {linkLabel ?? 'Configure'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
