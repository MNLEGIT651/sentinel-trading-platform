'use client';

import { useEffect, useState } from 'react';
import { Activity, Menu, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notification-center';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

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
  onCommandPalette?: () => void;
}

export function Header({ onMenuClick, onCommandPalette }: HeaderProps) {
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
    <header className="relative flex h-12 items-center justify-between border-b border-border bg-card/80 px-4">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-mono text-sm font-bold tracking-[0.2em] text-foreground/80 sm:hidden">
          SENTINEL
        </span>
        {/* Breadcrumbs - desktop only */}
        <Breadcrumbs className="hidden sm:flex" />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Command palette trigger */}
        {onCommandPalette && (
          <button
            type="button"
            onClick={onCommandPalette}
            className="hidden items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground sm:flex"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Search…</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
        )}

        <NotificationCenter />

        {/* Market status indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <Activity className="h-3 w-3 text-muted-foreground/60" />
          <div className="flex items-center gap-1.5">
            <div className={cn('h-1.5 w-1.5 rounded-full', marketOpen ? 'bg-profit' : 'bg-loss')} />
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {marketOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden h-4 w-px bg-border lg:block" />

        {/* Current ET time */}
        <div className="hidden items-center gap-1.5 lg:flex">
          <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
            {time}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/50 tracking-wider">ET</span>
        </div>

        {/* User avatar */}
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Account"
        >
          <User className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
