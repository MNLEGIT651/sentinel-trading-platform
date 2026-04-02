'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Brain, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom lg:hidden"
    >
      <div className="flex h-14 items-center justify-around px-2">
        {items.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon
                className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_6px_var(--color-primary)]')}
              />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
