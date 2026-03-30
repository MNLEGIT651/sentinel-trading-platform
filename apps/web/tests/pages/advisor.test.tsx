import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import AdvisorPage from '@/app/(dashboard)/advisor/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/advisor',
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('AdvisorPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<AdvisorPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page title', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByText('Advisor')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    renderWithProviders(<AdvisorPage />);
    expect(
      screen.getByText('Your profile, preferences, and conversation history'),
    ).toBeInTheDocument();
  });

  it('renders Memory tab', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByText('Memory')).toBeInTheDocument();
  });

  it('renders Conversations tab', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });
});
