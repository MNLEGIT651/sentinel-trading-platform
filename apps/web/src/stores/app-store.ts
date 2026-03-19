import { create } from 'zustand';

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  engineOnline: boolean;
  agentsOnline: boolean;
  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
  setEngineOnline: (online: boolean) => void;
  setAgentsOnline: (online: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  marketStatus: 'closed',
  engineOnline: false,
  agentsOnline: false,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMarketStatus: (status) => set({ marketStatus: status }),
  setEngineOnline: (online) => set({ engineOnline: online }),
  setAgentsOnline: (online) => set({ agentsOnline: online }),
}));
