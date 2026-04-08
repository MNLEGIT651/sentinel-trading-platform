'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Brain, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Markets', href: '/markets', icon: TrendingUp },
  { label: 'Strategies', href: '/strategies', icon: Brain },
  { label: 'Portfolio', href: '/portfolio', icon: PieChart },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="app-safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 w-full max-w-screen-md items-center justify-around px-2">
        {items.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-colors min-w-[56px]',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground active:bg-accent/50',
              )}
            >
              <item.icon
                className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_6px_var(--color-primary)]')}
              />
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
