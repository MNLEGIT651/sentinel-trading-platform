import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('DashboardPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<DashboardPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page-enter animation class', () => {
    const { container } = renderWithProviders(<DashboardPage />);
    const root = container.querySelector('.page-enter');
    expect(root).toBeInTheDocument();
  });

  it('renders the Dashboard heading', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the Total Equity metric card label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
  });

  it('renders the Daily P&L metric card label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Daily P&L')).toBeInTheDocument();
  });

  it('renders the Cash Available metric card label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Cash Available')).toBeInTheDocument();
  });

  it('renders the Positions Value metric card label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Positions Value')).toBeInTheDocument();
  });

  it('renders Active Signals card', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Active Signals')).toBeInTheDocument();
  });

  it('renders the No Recent Signals empty state', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('No Recent Signals')).toBeInTheDocument();
  });

  // --- Semantic HTML ---

  it('wraps system health in a section with aria-label', () => {
    renderWithProviders(<DashboardPage />);
    const section = screen.getByLabelText('System health status');
    expect(section.tagName).toBe('SECTION');
  });

  it('wraps portfolio metrics in a section with aria-label', () => {
    renderWithProviders(<DashboardPage />);
    const section = screen.getByLabelText('Portfolio metrics');
    expect(section.tagName).toBe('SECTION');
  });

  it('wraps market prices in a section with aria-label', () => {
    renderWithProviders(<DashboardPage />);
    const section = screen.getByLabelText('Market prices');
    expect(section.tagName).toBe('SECTION');
  });

  it('wraps signals and alerts in a section with aria-label', () => {
    renderWithProviders(<DashboardPage />);
    const section = screen.getByLabelText('Signals and alerts');
    expect(section.tagName).toBe('SECTION');
  });

  // --- System Health Strip ---

  it('displays default system health values when offline', () => {
    renderWithProviders(<DashboardPage />);
    const healthSection = screen.getByLabelText('System health status');
    expect(within(healthSection).getByText('Active')).toBeInTheDocument();
    expect(within(healthSection).getByText('paper')).toBeInTheDocument();
    expect(within(healthSection).getByText('0')).toBeInTheDocument();
    expect(within(healthSection).getByText('Idle')).toBeInTheDocument();
  });

  // --- ErrorBoundary ---

  it('is wrapped in ErrorBoundary (renders children on success)', () => {
    renderWithProviders(<DashboardPage />);
    // ErrorBoundary is transparent when no error - children render normally
    expect(screen.getByLabelText('Trading dashboard')).toBeInTheDocument();
  });

  // --- Accessibility ---

  it('marks decorative icons as aria-hidden', () => {
    renderWithProviders(<DashboardPage />);
    const healthSection = screen.getByLabelText('System health status');
    const hiddenIcons = healthSection.querySelectorAll('[aria-hidden="true"]');
    // Icons + separator pipes
    expect(hiddenIcons.length).toBeGreaterThanOrEqual(4);
  });

  it('has a root container with aria-label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByLabelText('Trading dashboard')).toBeInTheDocument();
  });
});
