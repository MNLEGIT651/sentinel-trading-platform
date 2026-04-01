import { create } from 'zustand';

import type { DeviceType } from '@/hooks/use-device-detect';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface StoreAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  /** null = health has not been probed yet */
  engineOnline: boolean | null;
  /** null = agents intentionally unconfigured in local development (skip banner) */
  agentsOnline: boolean | null;

  /* ── Device detection (synced from useDeviceDetect in AppShell) ── */
  deviceType: DeviceType;
  isTouch: boolean;

  /* ── Alerts ── */
  alerts: StoreAlert[];

  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
  setEngineOnline: (online: boolean | null) => void;
  setAgentsOnline: (online: boolean | null) => void;
  setDevice: (type: DeviceType, touch: boolean) => void;
  setAlerts: (alerts: StoreAlert[]) => void;
  acknowledgeAlert: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  mobileSidebarOpen: false,
  marketStatus: 'closed',
  engineOnline: null,
  agentsOnline: null,
  deviceType: 'desktop',
  isTouch: false,
  alerts: [],
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  setMarketStatus: (status) => set({ marketStatus: status }),
  setEngineOnline: (online) => set({ engineOnline: online }),
  setAgentsOnline: (online) => set({ agentsOnline: online }),
  setDevice: (type, touch) => set({ deviceType: type, isTouch: touch }),
  setAlerts: (alerts) => set({ alerts }),
  acknowledgeAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),
}));
