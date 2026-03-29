'use client';

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
  type LucideIcon,
} from 'lucide-react';
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

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

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
          onClick={onToggle}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
            collapsed && 'mx-auto mt-1',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.section} className="mb-3">
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.section}
              </p>
            )}
            {collapsed && <div className="mx-auto my-1 h-px w-6 bg-border" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      'group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border-l-2 border-transparent',
                      collapsed && 'justify-center px-2 border-l-0',
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
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
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
