'use client';

import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  service: 'engine' | 'agents';
  className?: string;
}

const messages = {
  engine: {
    title: 'Engine Offline',
    detail: 'Start the FastAPI engine to see live data. Data shown below is simulated.',
  },
  agents: {
    title: 'Agents Offline',
    detail: 'Start the agents server to enable AI agent functionality.',
  },
} as const;

export function OfflineBanner({ service, className }: OfflineBannerProps) {
  const msg = messages[service];
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3',
        className,
      )}
    >
      <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-300">{msg.title}</p>
        <p className="text-xs text-amber-400/80">{msg.detail}</p>
      </div>
    </div>
  );
}
