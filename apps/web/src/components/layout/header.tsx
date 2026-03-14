'use client';

import { useEffect, useState } from 'react';
import { Activity, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

function getETTime(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
  );
}

function isMarketOpen(): boolean {
  const et = getETTime();
  const day = et.getDay();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Monday (1) through Friday (5), 9:30 AM - 4:00 PM ET
  if (day >= 1 && day <= 5) {
    if (timeInMinutes >= 570 && timeInMinutes < 960) {
      return true;
    }
  }
  return false;
}

function formatETTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [time, setTime] = useState<string>('');
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    function tick() {
      const et = getETTime();
      setTime(formatETTime(et));
      setMarketOpen(isMarketOpen());
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-lg font-bold tracking-wider text-foreground">
          SENTINEL
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Trading Platform
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Market status indicator */}
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              marketOpen ? 'bg-profit' : 'bg-loss',
            )}
          />
          <span className="text-xs text-muted-foreground">
            {marketOpen ? 'Market Open' : 'Market Closed'}
          </span>
        </div>

        {/* Current ET time */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="font-mono text-xs text-muted-foreground">
            {time} ET
          </span>
        </div>
      </div>
    </header>
  );
}
