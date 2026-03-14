import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      selectedTicker: null,
      sidebarOpen: true,
      marketStatus: 'closed',
    });
  });

  it('has correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.selectedTicker).toBeNull();
    expect(state.sidebarOpen).toBe(true);
    expect(state.marketStatus).toBe('closed');
  });

  it('setSelectedTicker updates the selected ticker', () => {
    useAppStore.getState().setSelectedTicker('AAPL');
    expect(useAppStore.getState().selectedTicker).toBe('AAPL');

    useAppStore.getState().setSelectedTicker(null);
    expect(useAppStore.getState().selectedTicker).toBeNull();
  });

  it('toggleSidebar toggles the sidebar state', () => {
    expect(useAppStore.getState().sidebarOpen).toBe(true);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(false);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('setMarketStatus updates market status', () => {
    useAppStore.getState().setMarketStatus('open');
    expect(useAppStore.getState().marketStatus).toBe('open');

    useAppStore.getState().setMarketStatus('pre');
    expect(useAppStore.getState().marketStatus).toBe('pre');

    useAppStore.getState().setMarketStatus('post');
    expect(useAppStore.getState().marketStatus).toBe('post');

    useAppStore.getState().setMarketStatus('closed');
    expect(useAppStore.getState().marketStatus).toBe('closed');
  });
});
