import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import SettingsPage from '@/app/(dashboard)/settings/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the trading policy hook so tests don't depend on Supabase
const mockUpdatePolicy = vi.fn().mockResolvedValue(true);
let mockPolicyLoading = false;
let mockPolicyError: string | null = null;

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
    loading: mockPolicyLoading,
    saving: false,
    error: mockPolicyError,
    updatePolicy: mockUpdatePolicy,
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
    value: valueProp,
    onValueChange,
    className,
    children,
  }: {
    defaultValue?: string;
    value?: string;
    onValueChange?: (v: string) => void;
    className?: string;
    children: React.ReactNode;
  }) {
    const isControlled = valueProp !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? '');
    const value = isControlled ? valueProp : uncontrolledValue;
    const setValue = isControlled ? (v: string) => onValueChange?.(v) : setUncontrolledValue;
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
  mockPolicyLoading = false;
  mockPolicyError = null;
  mockUpdatePolicy.mockResolvedValue(true);
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

  it('shows Save Changes button with aria-label', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument();
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

  it('shows tab navigation with aria roles', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getAllByRole('tab', { name: /Risk/i })[0]).toBeInTheDocument();
      expect(screen.getAllByRole('tab', { name: /Alerts/i })[0]).toBeInTheDocument();
      expect(screen.getAllByRole('tab', { name: /Trading/i })[0]).toBeInTheDocument();
    });
  });

  it('Save Changes stores notification prefs to localStorage and calls updatePolicy', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    expect(localStorageMock.getItem('sentinel:notification-prefs')).not.toBeNull();
    expect(mockUpdatePolicy).toHaveBeenCalled();
  });

  it('Save Changes shows "Saved" feedback momentarily', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('can switch to Risk tab and shows form fields with labels', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('tab', { name: /Risk/i })[0]).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('tab', { name: /Risk/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Position Limits')).toBeInTheDocument();
      expect(screen.getByText('Circuit Breakers')).toBeInTheDocument();
    });
  });

  it('can switch to Alerts tab and shows toggle switches', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('tab', { name: /Alerts/i })[0]).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('tab', { name: /Alerts/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
      expect(screen.getByText('Warning Alerts')).toBeInTheDocument();
      // Toggle switches should have proper aria roles
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
    });
  });

  it('can switch to Trading tab and shows toggle fields', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('tab', { name: /Trading/i })[0]).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('tab', { name: /Trading/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
      expect(screen.getByText('Auto Trading')).toBeInTheDocument();
      // Toggle switches should have aria-checked
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
    });
  });

  it('shows system information on Trading tab', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('tab', { name: /Trading/i })[0]).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('tab', { name: /Trading/i })[0]);
    await waitFor(() => expect(screen.getByText('Sentinel Trading v0.1.0')).toBeInTheDocument());
  });

  it('renders page-enter class on root container', async () => {
    const { container } = renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    const root = container.querySelector('.page-enter');
    expect(root).toBeInTheDocument();
  });

  it('shows loading spinner when policy is loading', async () => {
    mockPolicyLoading = true;
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Loading settings…')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('connection status refresh has aria-label', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Service Status')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /test service connections/i })).toBeInTheDocument();
  });

  it('risk settings inputs use design system Input component', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('tab', { name: /Risk/i })[0]).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByRole('tab', { name: /Risk/i })[0]);
    await waitFor(() => {
      // Design system Input components have data-slot="input"
      const inputs = document.querySelectorAll('[data-slot="input"]');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });
});
