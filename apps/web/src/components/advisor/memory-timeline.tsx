'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AdvisorMemoryEvent, MemoryEventType } from '@sentinel/shared';
import { MEMORY_EVENT_LABELS } from '@sentinel/shared';
import { Brain, Check, Pencil, X, Trash2, RotateCcw, Clock, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MemoryTimelineProps {
  events: AdvisorMemoryEvent[];
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

const eventIcons: Record<MemoryEventType, LucideIcon> = {
  profile_updated: User,
  preference_learned: Brain,
  preference_confirmed: Check,
  preference_edited: Pencil,
  preference_dismissed: X,
  preference_deleted: Trash2,
  preference_restored: RotateCcw,
  preference_auto_expired: Clock,
};

const eventColors: Record<MemoryEventType, string> = {
  profile_updated: 'text-primary',
  preference_learned: 'text-amber-400',
  preference_confirmed: 'text-emerald-400',
  preference_edited: 'text-blue-400',
  preference_dismissed: 'text-muted-foreground',
  preference_deleted: 'text-red-400',
  preference_restored: 'text-primary',
  preference_auto_expired: 'text-muted-foreground',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function MemoryTimeline({ events, isLoading, className }: MemoryTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-5 w-5 rounded-full bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground italic', className)}>
        No memory events yet. Changes will appear here as you interact with the advisor.
      </p>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {events.map((event) => {
        const Icon = eventIcons[event.event_type as MemoryEventType] ?? Brain;
        const color = eventColors[event.event_type as MemoryEventType] ?? 'text-muted-foreground';
        const label = MEMORY_EVENT_LABELS[event.event_type as MemoryEventType] ?? event.event_type;

        return (
          <div key={event.id} className="flex items-center gap-2.5 text-xs">
            <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
            <span className="text-foreground">{label}</span>
            <Badge variant="outline" className="text-[10px]">
              {formatRelativeTime(event.created_at)}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
