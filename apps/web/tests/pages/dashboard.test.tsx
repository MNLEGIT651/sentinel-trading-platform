import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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

  it('renders the Total Equity metric card label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
  });

  it('renders the Daily P&L metric card label', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Daily P&L')).toBeInTheDocument();
  });
});
