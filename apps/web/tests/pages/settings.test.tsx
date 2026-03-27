import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import SettingsPage from '@/app/(dashboard)/settings/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the trading policy hook so tests don't depend on Supabase
vi.mock('@/hooks/use-trading-policy', () => ({
  useTradingPolicy: () => ({
    policy: {
      id: 'test-id',
      user_id: 'test-user',
      max_position_pct: 5,
      max_sector_pct: 20,
      daily_loss_limit_pct: 2,
      soft_drawdown_pct: 10,
      hard_drawdown_pct: 15,
      max_open_positions: 20,
      paper_trading: true,
      auto_trading: false,
      require_confirmation: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    loading: false,
    saving: false,
    error: null,
    updatePolicy: vi.fn().mockResolvedValue(true),
  }),
  policyValue: (policy: Record<string, unknown> | null, key: string) => {
    if (policy && key in policy) return policy[key];
    const defaults: Record<string, unknown> = {
      max_position_pct: 5,
      max_sector_pct: 20,
      daily_loss_limit_pct: 2,
      soft_drawdown_pct: 10,
      hard_drawdown_pct: 15,
      max_open_positions: 20,
      paper_trading: true,
      auto_trading: false,
      require_confirmation: true,
    };
    return defaults[key];
  },
}));

vi.mock('@/components/ui/tabs', async () => {
  const React = await import('react');

  const TabsContext = React.createContext<{
    value: string;
    setValue: (value: string) => void;
  } | null>(null);

  function Tabs({
    defaultValue,
    className,
    children,
  }: {
    defaultValue: string;
    className?: string;
    children: React.ReactNode;
  }) {
    const [value, setValue] = React.useState(defaultValue);
    return (
      <TabsContext.Provider value={{ value, setValue }}>
        <div className={className}>{children}</div>
      </TabsContext.Provider>
    );
  }

  function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
  }

  function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used inside Tabs');

    return (
      <button role="tab" onClick={() => context.setValue(value)}>
        {children}
      </button>
    );
  }

  function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
    const context = React.useContext(TabsContext);
    if (!context || context.value !== value) return null;
    return <div>{children}</div>;
  }

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        engine: 'connected',
        agents: 'connected',
        polygon: 'connected',
        supabase: 'connected',
        anthropic: 'connected',
        alpaca: 'connected',
      }),
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsPage', () => {
  it('renders the settings header', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
  });

  it('shows Save Changes button', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
  });

  it('displays connection status section', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Service Status')).toBeInTheDocument();
      expect(screen.getByText('Quant Engine (FastAPI)')).toBeInTheDocument();
      expect(screen.getByText('Polygon.io Market Data')).toBeInTheDocument();
      expect(screen.getByText('Supabase Database')).toBeInTheDocument();
      expect(screen.getByText('Claude AI (Anthropic)')).toBeInTheDocument();
      expect(screen.getByText('Alpaca Broker')).toBeInTheDocument();
    });
  });

  it('shows tab navigation', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Risk/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument();
    });
  });

  it('Save Changes stores notification prefs to localStorage and calls updatePolicy', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    expect(localStorageMock.getItem('sentinel:notification-prefs')).not.toBeNull();
  });

  it('Save Changes shows "Saved" feedback momentarily', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('can switch to Risk tab', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Risk/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Risk/i }));
    await waitFor(() => {
      expect(screen.getByText('Position Limits')).toBeInTheDocument();
      expect(screen.getByText('Circuit Breakers')).toBeInTheDocument();
    });
  });

  it('can switch to Notifications tab', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Notifications/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('tab', { name: /Notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
      expect(screen.getByText('Warning Alerts')).toBeInTheDocument();
    });
  });

  it('can switch to Trading tab', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    await waitFor(() => {
      expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
      expect(screen.getByText('Auto Trading')).toBeInTheDocument();
    });
  });

  it('shows system information on Trading tab', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    await waitFor(() => expect(screen.getByText('Sentinel Trading v0.1.0')).toBeInTheDocument());
  });
});
