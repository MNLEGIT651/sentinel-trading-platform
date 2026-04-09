import { ArrowRight } from 'lucide-react';
import type { RegimeEntry } from '@/hooks/queries';
import { getRegimeMeta } from './regime-constants';

export function RegimeTimeline({ history }: { history: RegimeEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium text-zinc-300">Recent History</h3>
      <div className="space-y-1">
        {history.slice(0, 10).map((entry, i) => {
          const meta = getRegimeMeta(entry.regime);
          const Icon = meta.icon;
          const nextEntry = history[i + 1];

          return (
            <div key={entry.id} className="flex items-center gap-2 text-xs">
              <div className={`flex items-center gap-1 ${meta.color}`}>
                <Icon className="h-3 w-3" />
                <span className="w-16 font-medium">{meta.label}</span>
              </div>
              <span className="text-zinc-500">{(entry.confidence * 100).toFixed(0)}%</span>
              {nextEntry && <ArrowRight className="h-3 w-3 text-zinc-700" />}
              <span className="ml-auto text-zinc-600">
                {new Date(entry.detected_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
