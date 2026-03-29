import { create } from 'zustand';

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  /** null = health has not been probed yet */
  engineOnline: boolean | null;
  /** null = agents intentionally unconfigured in local development (skip banner) */
  agentsOnline: boolean | null;
  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
  setEngineOnline: (online: boolean | null) => void;
  setAgentsOnline: (online: boolean | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  mobileSidebarOpen: false,
  marketStatus: 'closed',
  engineOnline: null,
  agentsOnline: null,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  setMarketStatus: (status) => set({ marketStatus: status }),
  setEngineOnline: (online) => set({ engineOnline: online }),
  setAgentsOnline: (online) => set({ agentsOnline: online }),
}));
