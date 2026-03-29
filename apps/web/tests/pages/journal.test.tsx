import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import JournalPage from '@/app/(dashboard)/journal/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/journal',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useJournalQuery: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
    useJournalStatsQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useGradeJournalMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('JournalPage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<JournalPage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByText('Decision Journal')).toBeInTheDocument();
  });

  it('shows empty state when no journal entries', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByText('No journal entries yet')).toBeInTheDocument();
  });
});
