'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { CommandPalette, useCommandPalette } from '@/components/command-palette';
import { useAppStore } from '@/stores/app-store';
import { useServiceHealth } from '@/hooks/use-service-health';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useDeviceDetect } from '@/hooks/use-device-detect';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen);
  const toggleMobileSidebar = useAppStore((s) => s.toggleMobileSidebar);
  const closeMobileSidebar = useAppStore((s) => s.closeMobileSidebar);
  const setDevice = useAppStore((s) => s.setDevice);
  const pathname = usePathname();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  // Device detection — single instance, synced to Zustand for global access
  const device = useDeviceDetect();

  useEffect(() => {
    if (device.isHydrated) {
      setDevice(device.type, device.isTouch);
    }
  }, [device.type, device.isTouch, device.isHydrated, setDevice]);

  // Single global health pulse — all pages read from the store
  useServiceHealth();

  // Bridge Supabase Realtime → TanStack Query cache invalidation
  useRealtimeSync();

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname, closeMobileSidebar]);

  // Mobile sidebar: Escape key + focus trap
  const mobileSidebarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const container = mobileSidebarRef.current;
    if (!container) return;

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobileSidebar();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last!.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first!.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen, closeMobileSidebar]);

  const shellLayoutVars = {
    '--shell-nav-height': '4rem',
    '--shell-bottom-offset': 'var(--shell-nav-height)',
  } as CSSProperties;

  return (
    <div
      className={cn(
        'app-shell-height flex overflow-hidden bg-background',
        device.isHydrated && device.isTouch && 'touch-device',
      )}
      {...(device.isHydrated ? { 'data-device': device.type } : {})}
    >
      {/* Desktop sidebar — always visible on lg+ screens */}
      <div className="hidden lg:block">
        <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />
      </div>

      {/* Mobile sidebar overlay — visible only on <lg when toggled */}
      {mobileSidebarOpen && (
        <div
          ref={mobileSidebarRef}
          role="dialog"
          aria-label="Navigation menu"
          aria-modal="true"
          className="lg:hidden"
        >
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closeMobileSidebar}
            onTouchEnd={closeMobileSidebar}
            aria-hidden="true"
          />
          <div className="fixed left-0 z-50 w-[min(22rem,88vw)] animate-in slide-in-from-left duration-200 top-[max(env(safe-area-inset-top),0.5rem)] bottom-[max(env(safe-area-inset-bottom),0.5rem)]">
            <Sidebar collapsed={false} onToggle={closeMobileSidebar} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden" style={shellLayoutVars}>
        <Header onMenuClick={toggleMobileSidebar} onCommandPalette={() => setCmdOpen(true)} />
        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-auto',
            device.isHydrated && device.isTouch && 'overscroll-contain',
            'pb-[calc(var(--shell-bottom-offset)+env(safe-area-inset-bottom))] lg:pb-0',
          )}
        >
          <div className="animate-sentinel-in">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Command palette (Cmd+K) */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
