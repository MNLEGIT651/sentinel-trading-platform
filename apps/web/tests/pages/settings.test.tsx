import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn() }),
}));

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
        polygon: 'connected',
        supabase: 'connected',
        anthropic: 'connected',
        alpaca: 'connected',
      }),
    }),
  );
});

describe('SettingsPage', () => {
  it('renders the settings header', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows Save Changes button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('displays connection status section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Service Status')).toBeInTheDocument();
    expect(screen.getByText('Quant Engine (FastAPI)')).toBeInTheDocument();
    expect(screen.getByText('Polygon.io Market Data')).toBeInTheDocument();
    expect(screen.getByText('Supabase Database')).toBeInTheDocument();
    expect(screen.getByText('Claude AI (Anthropic)')).toBeInTheDocument();
    expect(screen.getByText('Alpaca Broker')).toBeInTheDocument();
  });

  it('shows tab navigation', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /API Keys/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Risk/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Trading/i })).toBeInTheDocument();
  });

  it('Save Changes stores to localStorage', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Save Changes'));
    expect(localStorageMock.getItem('sentinel:settings')).not.toBeNull();
  });

  it('Save Changes shows "Saved" feedback momentarily', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Save Changes'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('can switch to Risk tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Risk/i }));
    expect(screen.getByText('Position Limits')).toBeInTheDocument();
    expect(screen.getByText('Circuit Breakers')).toBeInTheDocument();
  });

  it('can switch to Notifications tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Notifications/i }));
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
    expect(screen.getByText('Warning Alerts')).toBeInTheDocument();
  });

  it('can switch to Trading tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    expect(screen.getByText('Paper Trading Mode')).toBeInTheDocument();
    expect(screen.getByText('Auto Trading')).toBeInTheDocument();
  });

  it('shows system information on Trading tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    expect(screen.getByText('Sentinel Trading v0.1.0')).toBeInTheDocument();
  });
});
