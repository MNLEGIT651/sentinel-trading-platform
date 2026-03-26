'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertTriangle, Info, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function extractAlerts(json: unknown): unknown[] {
  if (json && typeof json === 'object' && Array.isArray((json as { alerts?: unknown }).alerts)) {
    return (json as { alerts: unknown[] }).alerts;
  }
  if (Array.isArray(json)) return json;
  return [];
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const readIds = loadReadIds();

    async function poll() {
      try {
        const res = await fetch('/api/agents/alerts');
        if (!res.ok || !mountedRef.current) return;
        const json: unknown = await res.json();
        const alerts = extractAlerts(json);
        if (alerts.length === 0 || !mountedRef.current) return;

        setNotifications((prev) => {
          const prevById = new Map(prev.map((n) => [n.id, n]));
          return alerts.slice(0, 20).map((a: Record<string, unknown>) => {
            const id = String(a.id ?? crypto.randomUUID());
            const existing = prevById.get(id);
            return {
              id,
              title: String(a.title ?? a.alert_type ?? 'Alert'),
              body: String(a.message ?? ''),
              severity: (['info', 'warning', 'critical'].includes(String(a.severity))
                ? String(a.severity)
                : 'info') as Notification['severity'],
              read: existing ? existing.read : readIds.has(id),
              created_at: String(a.created_at ?? new Date().toISOString()),
              source_type: 'alert',
              source_id: String(a.id ?? ''),
            };
          });
        });
      } catch {
        // Agent service may be offline — fail silently
      }
    }

    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const markRead = (id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      const ids = loadReadIds();
      ids.add(id);
      saveReadIds(ids);
      return next;
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => {
      const ids = loadReadIds();
      for (const n of prev) ids.add(n.id);
      saveReadIds(ids);
      return prev.map((n) => ({ ...n, read: true }));
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-loss text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                    aria-label="Mark all as read"
                  >
                    <Check className="h-3.5 w-3.5" />
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

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0',
                      !n.read && 'bg-primary/5',
                    )}
                  >
                    <div className="mt-0.5">{severityIcon(n.severity)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(n.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
