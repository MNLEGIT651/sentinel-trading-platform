import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn() }),
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
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
  });

  it('shows Save Changes button', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
  });

  it('displays connection status section', async () => {
    render(<SettingsPage />);
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
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Risk/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument();
    });
  });

  it('Save Changes stores to localStorage', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    expect(localStorageMock.getItem('sentinel:settings')).not.toBeNull();
  });

  it('Save Changes shows "Saved" feedback momentarily', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('can switch to Risk tab', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Risk/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Risk/i }));
    await waitFor(() => {
      expect(screen.getByText('Position Limits')).toBeInTheDocument();
      expect(screen.getByText('Circuit Breakers')).toBeInTheDocument();
    });
  });

  it('can switch to Notifications tab', async () => {
    render(<SettingsPage />);
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
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    await waitFor(() => {
      expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
      expect(screen.getByText('Auto Trading')).toBeInTheDocument();
    });
  });

  it('shows system information on Trading tab', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    await waitFor(() => expect(screen.getByText('Sentinel Trading v0.1.0')).toBeInTheDocument());
  });
});
