'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SignalBadgeProps {
  isActive: boolean;
}

export function SignalBadge({ isActive }: SignalBadgeProps) {
  return (
    <Badge
      className={cn(
        'ml-3 shrink-0 border text-[10px]',
        isActive
          ? 'bg-profit/15 text-profit border-profit/30'
          : 'bg-muted text-muted-foreground border-border',
      )}
    >
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}
