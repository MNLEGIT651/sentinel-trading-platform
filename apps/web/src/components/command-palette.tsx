'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Search,
  ArrowUpDown,
  Workflow,
  Beaker,
  CheckSquare,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: string;
  keywords?: string[];
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard, section: 'Overview' },
  { id: 'markets', label: 'Markets', href: '/markets', icon: TrendingUp, section: 'Overview' },
  {
    id: 'strategies',
    label: 'Strategies',
    href: '/strategies',
    icon: Brain,
    section: 'Trading',
    keywords: ['algo', 'trade'],
  },
  {
    id: 'signals',
    label: 'Signals',
    href: '/signals',
    icon: Zap,
    section: 'Trading',
    keywords: ['alert', 'scan'],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    href: '/portfolio',
    icon: PieChart,
    section: 'Trading',
    keywords: ['positions', 'holdings'],
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '/orders',
    icon: ArrowUpDown,
    section: 'Trading',
    keywords: ['buy', 'sell'],
  },
  {
    id: 'journal',
    label: 'Journal',
    href: '/journal',
    icon: BookOpen,
    section: 'Trading',
    keywords: ['notes', 'diary'],
  },
  {
    id: 'advisor',
    label: 'Advisor',
    href: '/advisor',
    icon: Sparkles,
    section: 'Trading',
    keywords: ['ai', 'recommend'],
  },
  {
    id: 'counterfactuals',
    label: 'What If',
    href: '/counterfactuals',
    icon: GitCompareArrows,
    section: 'Analysis',
  },
  {
    id: 'shadow',
    label: 'Shadow Portfolios',
    href: '/shadow-portfolios',
    icon: Layers,
    section: 'Analysis',
  },
  {
    id: 'regime',
    label: 'Regime',
    href: '/regime',
    icon: Gauge,
    section: 'Analysis',
    keywords: ['market condition'],
  },
  {
    id: 'data-quality',
    label: 'Data Quality',
    href: '/data-quality',
    icon: Database,
    section: 'Analysis',
  },
  { id: 'replay', label: 'Replay', href: '/replay', icon: Clock, section: 'Analysis' },
  {
    id: 'catalysts',
    label: 'Catalysts',
    href: '/catalysts',
    icon: Calendar,
    section: 'Analysis',
    keywords: ['events', 'earnings'],
  },
  { id: 'backtest', label: 'Backtest', href: '/backtest', icon: FlaskConical, section: 'Analysis' },
  {
    id: 'agents',
    label: 'Agents',
    href: '/agents',
    icon: Bot,
    section: 'Operations',
    keywords: ['automation'],
  },
  {
    id: 'experiment',
    label: 'Experiment',
    href: '/experiment',
    icon: Beaker,
    section: 'Operations',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    icon: CheckSquare,
    section: 'Operations',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    href: '/workflows',
    icon: Workflow,
    section: 'Operations',
  },
  {
    id: 'controls',
    label: 'System Controls',
    href: '/system-controls',
    icon: Shield,
    section: 'Governance',
    keywords: ['halt', 'mode'],
  },
  {
    id: 'autonomy',
    label: 'Autonomy',
    href: '/autonomy',
    icon: ShieldCheck,
    section: 'Governance',
  },
  {
    id: 'roles',
    label: 'Roles',
    href: '/roles',
    icon: Shield,
    section: 'Governance',
    keywords: ['team', 'permissions'],
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    href: '/audit-log',
    icon: ClipboardList,
    section: 'Governance',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    section: 'Governance',
    keywords: ['preferences', 'config'],
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.includes(q)),
    );
  }, [query]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      (groups[item.section] ??= []).push(item);
    }
    return groups;
  }, [filtered]);

  const flatItems = filtered;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && flatItems[activeIndex]) {
        e.preventDefault();
        navigate(flatItems[activeIndex].href);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [flatItems, activeIndex, navigate, onOpenChange],
  );

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  let itemIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-label="Command palette"
        className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            aria-label="Search pages"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-2" role="listbox">
          {flatItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(groupedResults).map(([section, items]) => (
              <div key={section}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {section}
                </div>
                {items.map((item) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      role="option"
                      aria-selected={idx === activeIndex}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                        idx === activeIndex
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/80 hover:bg-accent/50',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>
              open
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/** Hook to register the global Cmd+K / Ctrl+K shortcut */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen } as const;
}
