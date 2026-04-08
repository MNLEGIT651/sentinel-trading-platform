'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  PieChart,
  Bot,
  BookOpen,
  GitCompareArrows,
  Layers,
  Gauge,
  Database,
  Clock,
  Calendar,
  Shield,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  ArrowUpDown,
  Workflow,
  Beaker,
  LogOut,
  Loader2,
  Sparkles,
  type LucideIcon,
  Landmark,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type NavItem = { label: string; href: string; icon: LucideIcon };

type NavGroup = {
  section: string;
  priority: 'primary' | 'secondary';
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    section: 'Core Workflows',
    priority: 'primary',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Markets', href: '/markets', icon: TrendingUp },
      { label: 'Portfolio', href: '/portfolio', icon: PieChart },
      { label: 'Signals', href: '/signals', icon: Zap },
      { label: 'Orders', href: '/orders', icon: ArrowUpDown },
      { label: 'Agents', href: '/agents', icon: Bot },
      { label: 'Governance', href: '/system-controls', icon: Landmark },
    ],
  },
  {
    section: 'Research & Support',
    priority: 'secondary',
    items: [
      { label: 'Journal', href: '/journal', icon: BookOpen },
      { label: 'Advisor', href: '/advisor', icon: Sparkles },
      { label: 'What If', href: '/counterfactuals', icon: GitCompareArrows },
      { label: 'Shadow Portfolios', href: '/shadow-portfolios', icon: Layers },
      { label: 'Regime', href: '/regime', icon: Gauge },
      { label: 'Data Quality', href: '/data-quality', icon: Database },
      { label: 'Replay', href: '/replay', icon: Clock },
      { label: 'Catalysts', href: '/catalysts', icon: Calendar },
      { label: 'Backtest', href: '/backtest', icon: Beaker },
      { label: 'Experiment', href: '/experiment', icon: Beaker },
      { label: 'Approvals', href: '/approvals', icon: CheckSquare },
      { label: 'Workflows', href: '/workflows', icon: Workflow },
      { label: 'Roles', href: '/roles', icon: Shield },
      { label: 'Audit Log', href: '/audit-log', icon: ClipboardList },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const COLLAPSE_KEY = 'sentinel-sidebar-collapsed';
const SECONDARY_OPEN_KEY = 'sentinel-sidebar-secondary-open';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed: controlledCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved === 'true') setInternalCollapsed(true);

      const savedSecondary = localStorage.getItem(SECONDARY_OPEN_KEY);
      setSecondaryOpen(savedSecondary === 'true');
    } catch {
      /* noop */
    }
  }, []);

  const collapsed = controlledCollapsed ?? internalCollapsed;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* noop */
      }
    }
  };

  const persistSecondaryState = (next: boolean) => {
    setSecondaryOpen(next);
    try {
      localStorage.setItem(SECONDARY_OPEN_KEY, String(next));
    } catch {
      /* noop */
    }
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-mono text-xs font-bold tracking-[0.25em] text-foreground/85">
              SENTINEL
            </span>
          </div>
        )}
        {collapsed && <div className="h-1.5 w-1.5 rounded-full bg-primary mx-auto" />}
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
            collapsed && 'mx-auto mt-1',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups
          .filter((group) => group.priority === 'primary')
          .map((group) => (
            <div key={group.section} role="group" aria-label={group.section} className="mb-4">
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  {group.section}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                  return (
                    <li key={item.href} className="relative group">
                      <Link
                        href={item.href}
                        prefetch={false}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          isActive
                            ? 'bg-primary/12 text-primary'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                          collapsed && 'justify-center px-2',
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            isActive
                              ? 'text-primary'
                              : 'text-muted-foreground group-hover:text-foreground',
                          )}
                        />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                      {collapsed && (
                        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:flex items-center">
                          <div className="whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg animate-tooltip">
                            {item.label}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

        <details
          open={secondaryOpen}
          onToggle={(event) =>
            persistSecondaryState((event.currentTarget as HTMLDetailsElement).open)
          }
          className={cn('mt-3 border-t border-border/80 pt-3', collapsed && 'border-t-0 pt-1')}
        >
          {!collapsed && (
            <summary className="cursor-pointer list-none select-none rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/55 hover:bg-accent/30">
              Secondary Surfaces
            </summary>
          )}

          <ul className={cn('space-y-0.5', !collapsed && 'mt-1.5')}>
            {navGroups
              .filter((group) => group.priority === 'secondary')
              .flatMap((group) => group.items)
              .map((item) => {
                const isActive =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <li key={item.href} className="relative group">
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground/85 hover:bg-accent/40 hover:text-foreground',
                        !isActive && 'opacity-85',
                        collapsed && 'justify-center px-2',
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                    {collapsed && (
                      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:flex items-center">
                        <div className="whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg animate-tooltip">
                          {item.label}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </details>
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            if (signingOut) return;
            setSigningOut(true);
            try {
              const { createClient } = await import('@/lib/supabase/client');
              const supabase = createClient();
              await supabase.auth.signOut();
              queryClient.clear();
            } catch {
              // Even if signOut fails, redirect to login to force re-auth
            }
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          title="Sign out"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-profit" />
            <p className="font-mono text-[10px] text-muted-foreground tracking-wider">v0.1.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}
