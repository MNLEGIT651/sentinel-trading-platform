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
  CornerDownLeft,
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

const RECENTS_KEY = 'sentinel-cmd-recents';
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string): void {
  try {
    const prev = loadRecents().filter((r) => r !== id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENTS)));
  } catch {
    // localStorage unavailable
  }
}

/** Simple fuzzy scoring — returns 0 (no match) or positive score (higher = better) */
function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  // Exact substring match — high score
  if (t.includes(q)) return 100 + (q.length / t.length) * 50;
  // Character-by-character fuzzy
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2 + (ti === 0 ? 10 : 0);
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : 0;
}

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

  const recentIds = useMemo(() => (open ? loadRecents() : []), [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show recents first, then all commands
      const recents = recentIds
        .map((id) => COMMANDS.find((c) => c.id === id))
        .filter(Boolean) as CommandItem[];
      return { items: COMMANDS, recents };
    }
    const q = query.trim();
    const scored = COMMANDS.map((c) => {
      const labelScore = fuzzyScore(c.label, q);
      const sectionScore = fuzzyScore(c.section, q) * 0.5;
      const keywordScore = Math.max(0, ...(c.keywords?.map((k) => fuzzyScore(k, q)) ?? [0])) * 0.7;
      return { item: c, score: Math.max(labelScore, sectionScore, keywordScore) };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return { items: scored.map((s) => s.item), recents: [] };
  }, [query, recentIds]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    if (filtered.recents.length > 0) {
      groups['Recent'] = filtered.recents;
    }
    for (const item of filtered.items) {
      // Skip items already shown in recents when no query
      if (!query.trim() && filtered.recents.some((r) => r.id === item.id)) continue;
      (groups[item.section] ??= []).push(item);
    }
    return groups;
  }, [filtered, query]);

  const flatItems = useMemo(() => {
    const items: CommandItem[] = [];
    for (const group of Object.values(groupedResults)) {
      items.push(...group);
    }
    return items;
  }, [groupedResults]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const navigate = useCallback(
    (item: CommandItem) => {
      saveRecent(item.id);
      onOpenChange(false);
      router.push(item.href);
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
        navigate(flatItems[activeIndex]);
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
            placeholder="Search pages and actions\u2026"
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
                      key={`${section}-${item.id}`}
                      data-index={idx}
                      role="option"
                      aria-selected={idx === activeIndex}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                        idx === activeIndex
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/80 hover:bg-accent/50',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {idx === activeIndex && (
                        <CornerDownLeft className="h-3 w-3 text-muted-foreground/40" />
                      )}
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
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">
                &uarr;&darr;
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">
                &crarr;
              </kbd>
              open
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">
            {flatItems.length} result{flatItems.length !== 1 ? 's' : ''}
          </span>
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
