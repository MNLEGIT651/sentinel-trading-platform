'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecommendationEvent } from '@sentinel/shared';
import { EVENT_CATEGORY_COLORS, EVENT_ICONS } from '../_constants';
import { formatEventType, formatTimestamp } from '../_helpers';

export function RecEventTimeline({ events }: { events: RecommendationEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No lifecycle events recorded.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />

      <div className="space-y-0">
        {events.map((ev, idx) => {
          const catLookup = EVENT_CATEGORY_COLORS[ev.event_type];
          const cat = catLookup ?? {
            bg: 'bg-blue-500/5',
            border: 'border-blue-500/30',
            dot: 'bg-blue-400',
          };
          const IconLookup = EVENT_ICONS[ev.event_type];
          const Icon = IconLookup ?? Clock;
          const isExpanded = expandedId === ev.id;
          const isFirst = idx === 0;
          const isLast = idx === events.length - 1;

          return (
            <div key={ev.id} className="relative flex items-start gap-3 pl-0">
              {/* Timeline dot */}
              <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center">
                <div className={cn('h-3 w-3 rounded-full ring-2 ring-gray-800', cat.dot)} />
              </div>

              {/* Event card */}
              <div
                className={cn(
                  'flex-1 rounded-lg border p-3 transition-colors cursor-pointer',
                  cat.bg,
                  cat.border,
                  isFirst && 'mt-0',
                  isLast && 'mb-0',
                )}
                onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-3.5 w-3.5', cat.dot.replace('bg-', 'text-'))} />
                  <span className="text-sm font-medium text-gray-200 capitalize">
                    {formatEventType(ev.event_type)}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ev.actor_type}
                    {ev.actor_id ? ` · ${ev.actor_id}` : ''}
                  </span>
                  <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
                    {formatTimestamp(ev.event_ts)}
                  </span>
                  {Object.keys(ev.payload || {}).length > 0 &&
                    (isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                    ))}
                </div>

                {/* Inline payload summary */}
                {!isExpanded && ev.payload && Object.keys(ev.payload).length > 0 && (
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {Object.entries(ev.payload)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? '...' : String(v)}`)
                      .join(' · ')}
                  </p>
                )}

                {/* Expanded payload */}
                {isExpanded && ev.payload && Object.keys(ev.payload).length > 0 && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900/50 p-2 text-xs text-gray-400">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
