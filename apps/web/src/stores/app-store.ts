import { create } from 'zustand';

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  marketStatus: 'closed',
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMarketStatus: (status) => set({ marketStatus: status }),
}));
