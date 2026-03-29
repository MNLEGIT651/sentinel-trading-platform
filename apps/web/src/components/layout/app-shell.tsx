'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAppStore } from '@/stores/app-store';
import { useServiceHealth } from '@/hooks/use-service-health';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen);
  const toggleMobileSidebar = useAppStore((s) => s.toggleMobileSidebar);
  const closeMobileSidebar = useAppStore((s) => s.closeMobileSidebar);
  const pathname = usePathname();

  // Single global health pulse — all pages read from the store
  useServiceHealth();

  // Bridge Supabase Realtime → TanStack Query cache invalidation
  useRealtimeSync();

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname, closeMobileSidebar]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — always visible on lg+ screens */}
      <div className="hidden lg:block">
        <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />
      </div>

      {/* Mobile sidebar overlay — visible only on <lg when toggled */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeMobileSidebar}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar collapsed={false} onToggle={closeMobileSidebar} />
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={toggleMobileSidebar} />
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
