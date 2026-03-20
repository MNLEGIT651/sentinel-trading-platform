import { create } from 'zustand';

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  engineOnline: boolean;
  /** null = agents URL not configured (skip banner) */
  agentsOnline: boolean | null;
  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
  setEngineOnline: (online: boolean) => void;
  setAgentsOnline: (online: boolean | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  marketStatus: 'closed',
  engineOnline: false,
  agentsOnline: null,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMarketStatus: (status) => set({ marketStatus: status }),
  setEngineOnline: (online) => set({ engineOnline: online }),
  setAgentsOnline: (online) => set({ agentsOnline: online }),
}));
