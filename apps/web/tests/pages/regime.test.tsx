import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import RegimePage from '@/app/(dashboard)/regime/page';
import { renderWithProviders } from '../test-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/regime',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/queries')>();
  return {
    ...actual,
    useRegimeStateQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useRecordRegimeMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    usePlaybooksQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useCreatePlaybookMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    useDeletePlaybookMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    useTogglePlaybookMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('RegimePage', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<RegimePage />);
    expect(container).toBeTruthy();
  });

  it('renders the page heading', () => {
    renderWithProviders(<RegimePage />);
    expect(screen.getByText('Regime Detection')).toBeInTheDocument();
  });

  it('shows the Set Regime button', () => {
    renderWithProviders(<RegimePage />);
    expect(screen.getByText('Set Regime')).toBeInTheDocument();
  });

  it('shows the Playbooks section', () => {
    renderWithProviders(<RegimePage />);
    expect(screen.getByText('Playbooks')).toBeInTheDocument();
  });
});
