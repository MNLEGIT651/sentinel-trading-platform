'use client';

import { useState, useMemo } from 'react';
import { Bell, X, AlertTriangle, Info, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlertsQuery } from '@/hooks/queries';

interface Notification {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  created_at: string;
  source_type?: 'recommendation' | 'alert';
  source_id?: string;
}

const STORAGE_KEY = 'sentinel-read-notifications';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: agentAlerts } = useAlertsQuery(30_000);

  const [manualReadIds, setManualReadIds] = useState<Set<string>>(() => loadReadIds());

  const notifications: Notification[] = useMemo(() => {
    if (!agentAlerts || agentAlerts.length === 0) return [];
    return agentAlerts.slice(0, 20).map((a) => {
      const id = String(a.id ?? crypto.randomUUID());
      return {
        id,
        title: String(a.title ?? 'Alert'),
        body: String(a.message ?? ''),
        severity: (['info', 'warning', 'critical'].includes(String(a.severity))
          ? String(a.severity)
          : 'info') as Notification['severity'],
        read: manualReadIds.has(id),
        created_at: String(a.created_at ?? new Date().toISOString()),
        source_type: 'alert' as const,
        source_id: String(a.id ?? ''),
      };
    });
  }, [agentAlerts, manualReadIds]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    setManualReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  const markAllRead = () => {
    setManualReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      saveReadIds(next);
      return next;
    });
  };

  const severityIcon = (severity: Notification['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-loss" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  /** Group notifications by day: Today, Yesterday, Earlier */
  const grouped = useMemo(() => {
    if (notifications.length === 0) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86_400_000;
    const groups: { label: string; items: Notification[] }[] = [];
    const buckets: Record<string, Notification[]> = {};
    for (const n of notifications) {
      const ts = new Date(n.created_at).getTime();
      const label = ts >= today ? 'Today' : ts >= yesterday ? 'Yesterday' : 'Earlier';
      (buckets[label] ??= []).push(n);
    }
    for (const label of ['Today', 'Yesterday', 'Earlier']) {
      if (buckets[label]?.length) groups.push({ label, items: buckets[label] });
    }
    return groups;
  }, [notifications]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors active:scale-95"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-loss text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-2xl shadow-black/30 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                    aria-label="Mark all as read"
                  >
                    <Check className="h-3 w-3" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-3">
                    <Bell className="h-5 w-5 text-primary/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80">All clear</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    System and trading alerts appear here
                  </p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 bg-card/95 backdrop-blur-sm px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-b border-border/30">
                      {group.label}
                    </div>
                    {group.items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0',
                          !n.read && 'bg-primary/5',
                        )}
                      >
                        <div className="mt-0.5 shrink-0">{severityIcon(n.severity)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm leading-snug', !n.read && 'font-medium')}>
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {n.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
                            {new Date(n.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
