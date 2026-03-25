import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('DashboardPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<DashboardPage />);
    expect(container).toBeTruthy();
  });

  it('renders the Total Equity metric card label', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
  });

  it('renders the Daily P&L metric card label', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Daily P&L')).toBeInTheDocument();
  });
});
