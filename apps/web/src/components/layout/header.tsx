'use client';

import { useEffect, useState } from 'react';
import { Activity, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notification-center';

function getETTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
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
    hour12: false,
  });
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [time, setTime] = useState<string>('');
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    let frameId: number;
    let lastTime = '';
    let lastMarketOpen: boolean | undefined;

    function tick() {
      const et = getETTime();
      const formatted = formatETTime(et);
      if (formatted !== lastTime) {
        lastTime = formatted;
        setTime(formatted);
        const open = isMarketOpen();
        if (open !== lastMarketOpen) {
          lastMarketOpen = open;
          setMarketOpen(open);
        }
      }
      frameId = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 relative">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden transition-colors active:scale-95"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-mono text-sm font-bold tracking-[0.2em] text-foreground/80">
          SENTINEL
        </span>
        <span className="hidden font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase sm:inline">
          Trading Platform
        </span>
      </div>

      <div className="flex items-center gap-5">
        <NotificationCenter />
        {/* Market status indicator */}
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-muted-foreground/60" />
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                marketOpen ? 'bg-profit animate-pulse' : 'bg-loss',
              )}
            />
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {marketOpen ? 'MKT OPEN' : 'MKT CLOSED'}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden h-4 w-px bg-border sm:block" />

        {/* Current ET time */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
            {time}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/50 tracking-wider">ET</span>
        </div>
      </div>
    </header>
  );
}
