'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAppStore } from '@/stores/app-store';
import { useServiceHealth } from '@/hooks/use-service-health';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  // Single global health pulse — all pages read from the store
  useServiceHealth();

  // Bridge Supabase Realtime → TanStack Query cache invalidation
  useRealtimeSync();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
