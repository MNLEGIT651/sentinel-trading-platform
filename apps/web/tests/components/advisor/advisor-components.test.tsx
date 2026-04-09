import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// Pre-load components once to avoid per-test dynamic import overhead
let ExplanationCard: ComponentType<Record<string, unknown>>;
let ConfidenceMeter: ComponentType<Record<string, unknown>>;
let PreferenceCard: ComponentType<Record<string, unknown>>;
let MemoryTimeline: ComponentType<Record<string, unknown>>;

beforeAll(async () => {
  [{ ExplanationCard }, { ConfidenceMeter }, { PreferenceCard }, { MemoryTimeline }] =
    await Promise.all([
      import('@/components/advisor/explanation-card'),
      import('@/components/advisor/confidence-meter'),
      import('@/components/advisor/preference-card'),
      import('@/components/advisor/memory-timeline'),
    ]);
});

// ─── ExplanationCard ────────────────────────────────────────────────

describe('ExplanationCard', () => {
  it('renders loading state', () => {
    const { container } = render(<ExplanationCard explanation={undefined} isLoading />);

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
  });

  it('renders null when no explanation exists', () => {
    const { container } = render(<ExplanationCard explanation={null} />);

    expect(container.innerHTML).toBe('');
  });
});

// ─── ConfidenceMeter ────────────────────────────────────────────────

describe('ConfidenceMeter', () => {
  it('renders confidence value and label', () => {
    render(<ConfidenceMeter confidence={0.85} />);

    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
  });

  it('shows medium for mid-range confidence', () => {
    render(<ConfidenceMeter confidence={0.55} />);

    expect(screen.getByText(/55%/)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('shows low for low confidence', () => {
    render(<ConfidenceMeter confidence={0.2} />);

    expect(screen.getByText(/20%/)).toBeInTheDocument();
    expect(screen.getByText(/low/i)).toBeInTheDocument();
  });
});

// ─── PreferenceCard ─────────────────────────────────────────────────

describe('PreferenceCard', () => {
  it('renders preference content', () => {
    const pref = {
      id: 'pref-1',
      user_id: 'u1',
      category: 'sector' as const,
      content: 'Avoid biotech stocks',
      context: 'Bad experience with MRNA',
      source: 'explicit' as const,
      confidence: 1.0,
      status: 'active' as const,
      originating_message_id: null,
      confirmed_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    render(<PreferenceCard preference={pref} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Avoid biotech stocks')).toBeInTheDocument();
    expect(screen.getByText('Bad experience with MRNA')).toBeInTheDocument();
  });

  it('shows confirm/dismiss for pending preferences', () => {
    const pref = {
      id: 'pref-2',
      user_id: 'u1',
      category: 'risk_tolerance' as const,
      content: 'Prefers conservative positions',
      context: null,
      source: 'inferred' as const,
      confidence: 0.7,
      status: 'pending_confirmation' as const,
      originating_message_id: null,
      confirmed_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    render(
      <PreferenceCard preference={pref} onConfirm={vi.fn()} onDismiss={vi.fn()} onEdit={vi.fn()} />,
    );

    expect(screen.getByText('Prefers conservative positions')).toBeInTheDocument();
  });
});

// ─── MemoryTimeline ─────────────────────────────────────────────────

describe('MemoryTimeline', () => {
  it('renders empty state', () => {
    render(<MemoryTimeline events={[]} />);

    expect(screen.getByText(/no memory events yet/i)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const { container } = render(<MemoryTimeline events={[]} isLoading />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders events', () => {
    const events = [
      {
        id: 'e1',
        user_id: 'u1',
        preference_id: null,
        event_type: 'preference_learned' as const,
        previous_value: null,
        new_value: { content: 'Avoid biotech' },
        metadata: {},
        created_at: new Date().toISOString(),
      },
    ];

    render(<MemoryTimeline events={events} />);
    expect(screen.getByText('Preference learned')).toBeInTheDocument();
  });
});
