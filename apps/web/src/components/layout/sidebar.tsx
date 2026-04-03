'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Brain,
  Zap,
  PieChart,
  FlaskConical,
  Bot,
  BookOpen,
  GitCompareArrows,
  Layers,
  Gauge,
  Database,
  Clock,
  Calendar,
  Shield,
  ShieldCheck,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  Power,
  CheckSquare,
  ArrowUpDown,
  Workflow,
  Beaker,
  LogOut,
  Loader2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavSection = { section: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Markets', href: '/markets', icon: TrendingUp },
    ],
  },
  {
    section: 'Trading',
    items: [
      { label: 'Strategies', href: '/strategies', icon: Brain },
      { label: 'Signals', href: '/signals', icon: Zap },
      { label: 'Portfolio', href: '/portfolio', icon: PieChart },
      { label: 'Orders', href: '/orders', icon: ArrowUpDown },
      { label: 'Journal', href: '/journal', icon: BookOpen },
      { label: 'Advisor', href: '/advisor', icon: Sparkles },
    ],
  },
  {
    section: 'Analysis',
    items: [
      { label: 'What If', href: '/counterfactuals', icon: GitCompareArrows },
      { label: 'Shadow', href: '/shadow-portfolios', icon: Layers },
      { label: 'Regime', href: '/regime', icon: Gauge },
      { label: 'Data Quality', href: '/data-quality', icon: Database },
      { label: 'Replay', href: '/replay', icon: Clock },
      { label: 'Catalysts', href: '/catalysts', icon: Calendar },
      { label: 'Backtest', href: '/backtest', icon: FlaskConical },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Agents', href: '/agents', icon: Bot },
      { label: 'Experiment', href: '/experiment', icon: Beaker },
      { label: 'Approvals', href: '/approvals', icon: CheckSquare },
      { label: 'Workflows', href: '/workflows', icon: Workflow },
    ],
  },
  {
    section: 'Governance',
    items: [
      { label: 'Controls', href: '/system-controls', icon: Power },
      { label: 'Autonomy', href: '/autonomy', icon: ShieldCheck },
      { label: 'Roles', href: '/roles', icon: Shield },
      { label: 'Audit Log', href: '/audit-log', icon: ClipboardList },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const COLLAPSE_KEY = 'sentinel-sidebar-collapsed';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed: controlledCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  // Persist collapse state in localStorage
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved === 'true') setInternalCollapsed(true);
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

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Accent line along right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />

      {/* Logo area */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-[0.25em] text-primary">
              SENTINEL
            </span>
          </div>
        )}
        {collapsed && <div className="h-2 w-2 rounded-full bg-primary animate-pulse mx-auto" />}
        <button
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

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.section} role="group" aria-label={section.section} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {section.section}
              </p>
            )}
            {collapsed && <div className="mx-auto my-2 h-px w-6 bg-border/60" />}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <li key={item.href} className="relative group">
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        isActive
                          ? 'bg-primary/10 text-primary'
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
                    {/* Tooltip for collapsed mode */}
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
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-3">
        <button
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
