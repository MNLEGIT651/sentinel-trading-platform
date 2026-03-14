import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn() }),
}));

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

  it('shows API key input fields on the API Keys tab', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Polygon.io API Key')).toBeInTheDocument();
    expect(screen.getByText('Anthropic API Key')).toBeInTheDocument();
  });

  it('Save Changes shows "Saved" feedback', async () => {
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

  it('shows system information', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Trading/i }));
    expect(screen.getByText('Sentinel Trading v0.1.0')).toBeInTheDocument();
  });
});
