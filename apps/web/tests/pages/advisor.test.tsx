import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import AdvisorPage from '@/app/(dashboard)/advisor/page';
import { useAppStore } from '@/stores/app-store';
import { renderWithProviders } from '../test-utils';

const pushFn = vi.fn();
const replaceFn = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/advisor',
  useRouter: () => ({ push: pushFn, replace: replaceFn }),
  useSearchParams: () => mockSearchParams,
}));

const mockThreads = [
  {
    id: 'thread-1',
    user_id: 'user-1',
    title: 'Investment strategy discussion',
    message_count: 5,
    last_activity: new Date().toISOString(),
    rolling_summary: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'thread-2',
    user_id: 'user-1',
    title: 'Risk management questions',
    message_count: 3,
    last_activity: new Date(Date.now() - 3600000).toISOString(),
    rolling_summary: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

const mockMessages = [
  {
    id: 'msg-1',
    thread_id: 'thread-1',
    role: 'user' as const,
    content: 'What stocks should I invest in?',
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'msg-2',
    thread_id: 'thread-1',
    role: 'assistant' as const,
    content: 'Based on your risk profile, I recommend diversified ETFs.',
    created_at: new Date().toISOString(),
  },
];

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  risk_tolerance: 'moderate',
  experience_level: 'intermediate',
  investment_goals: ['growth', 'income'],
  completeness: 75,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const mockPreferences = { preferences: [], total: 0 };
const mockMemoryEvents = { events: [], total: 0 };

function makeFetchMock(opts?: {
  threadOverride?: unknown;
  messageOverride?: unknown;
  threadsFail?: boolean;
  messageSendFail?: boolean;
}) {
  const threadsResp = opts?.threadOverride ?? { threads: mockThreads, total: mockThreads.length };
  const messagesResp = opts?.messageOverride ?? {
    messages: mockMessages,
    total: mockMessages.length,
  };
  return vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.endsWith('/api/advisor/threads') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'thread-new',
            user_id: 'user-1',
            title: 'New conversation',
            message_count: 0,
            last_activity: new Date().toISOString(),
            rolling_summary: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
      } as Response);
    }
    if (urlStr.includes('/messages') && init?.method === 'POST') {
      if (opts?.messageSendFail) return Promise.resolve({ ok: false, status: 500 } as Response);
      const body = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'msg-new',
            thread_id: 'thread-1',
            role: body.role,
            content: body.content,
            created_at: new Date().toISOString(),
          }),
      } as Response);
    }
    if (urlStr.includes('/threads/') && urlStr.includes('/messages')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(messagesResp) } as Response);
    }
    if (urlStr.includes('/api/advisor/threads')) {
      if (opts?.threadsFail) return Promise.resolve({ ok: false, status: 500 } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(threadsResp) } as Response);
    }
    if (urlStr.includes('/api/advisor/profile'))
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) } as Response);
    if (urlStr.includes('/api/advisor/preferences'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPreferences),
      } as Response);
    if (urlStr.includes('/api/advisor/memory-events'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMemoryEvents),
      } as Response);
    return Promise.resolve({ ok: false, status: 404 } as Response);
  }) as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockSearchParams = new URLSearchParams();
  pushFn.mockClear();
  replaceFn.mockClear();
  useAppStore.setState({ agentsOnline: true });
  global.fetch = makeFetchMock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AdvisorPage', () => {
  it('renders the page header', async () => {
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('Advisor')).toBeInTheDocument();
    });
  });

  it('renders the page description', () => {
    renderWithProviders(<AdvisorPage />);
    expect(
      screen.getByText('Your profile, preferences, and conversation history'),
    ).toBeInTheDocument();
  });

  it('shows Agents Online badge', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByText('Agents Online')).toBeInTheDocument();
  });

  it('shows Agents Offline badge when down', () => {
    useAppStore.setState({ agentsOnline: false });
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByText('Agents Offline')).toBeInTheDocument();
  });

  it('shows degraded-mode banner when agents offline', () => {
    useAppStore.setState({ agentsOnline: false });
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByText('Agent service unavailable')).toBeInTheDocument();
    expect(screen.getByText(/browse existing conversations/)).toBeInTheDocument();
  });

  it('hides degraded-mode banner when agents online', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.queryByText('Agent service unavailable')).not.toBeInTheDocument();
  });

  it('renders Memory and Conversations tabs', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByRole('tab', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Conversations' })).toBeInTheDocument();
  });

  it('defaults to memory tab', () => {
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByRole('tab', { name: 'Memory' })).toHaveAttribute('data-active', '');
  });

  it('opens conversations tab from URL', () => {
    mockSearchParams = new URLSearchParams('tab=conversations');
    renderWithProviders(<AdvisorPage />);
    expect(screen.getByRole('tab', { name: 'Conversations' })).toHaveAttribute('data-active', '');
  });

  it('shows thread list when Conversations tab active', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('Investment strategy discussion')).toBeInTheDocument();
      expect(screen.getByText('Risk management questions')).toBeInTheDocument();
    });
  });

  it('shows thread count badge', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows empty state when no threads exist', async () => {
    global.fetch = makeFetchMock({ threadOverride: { threads: [], total: 0 } });
    mockSearchParams = new URLSearchParams('tab=conversations');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });
  });

  it('shows error with retry when threads fail', async () => {
    global.fetch = makeFetchMock({ threadsFail: true });
    mockSearchParams = new URLSearchParams('tab=conversations');
    renderWithProviders(<AdvisorPage />);
    await waitFor(
      () => {
        expect(screen.getByText('Failed to load conversations')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }, 10_000);

  it('updates URL when a thread is selected', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('Investment strategy discussion')).toBeInTheDocument();
    });
    const btn = screen.getByText('Investment strategy discussion').closest('button');
    fireEvent.click(btn!);
    await waitFor(() => {
      expect(replaceFn).toHaveBeenCalledWith(
        expect.stringContaining('threadId=thread-1'),
        expect.anything(),
      );
    });
  });

  it('restores thread from URL and shows messages', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('What stocks should I invest in?')).toBeInTheDocument();
    });
  });

  it('shows both user and assistant messages', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(
        screen.getByText('Based on your risk profile, I recommend diversified ETFs.'),
      ).toBeInTheDocument();
    });
  });

  it('shows message count badge', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('2 messages')).toBeInTheDocument();
    });
  });

  it('shows empty message prompt for new thread', async () => {
    global.fetch = makeFetchMock({ messageOverride: { messages: [], total: 0 } });
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText(/Start the conversation/)).toBeInTheDocument();
    });
  });

  it('clears threadId from URL when back is clicked', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByText('Investment strategy discussion')).toBeInTheDocument();
    });
    // Back button is in the same row as the thread title
    const titleEl = screen.getByText('Investment strategy discussion');
    const backBtn = titleEl.parentElement!.querySelector('button');
    fireEvent.click(backBtn!);
    await waitFor(() => {
      expect(replaceFn).toHaveBeenCalledWith(
        expect.not.stringContaining('threadId='),
        expect.anything(),
      );
    });
  });

  it('shows loading skeleton while threads load', async () => {
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as typeof fetch;
    mockSearchParams = new URLSearchParams('tab=conversations');
    const { container } = renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="thread-list-skeleton"]')).toBeTruthy();
    });
  });

  it('shows message loading skeleton', async () => {
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/advisor/threads') && !urlStr.includes('/messages'))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: mockThreads, total: mockThreads.length }),
        } as Response);
      if (urlStr.includes('/messages')) return new Promise<Response>(() => {});
      if (urlStr.includes('/api/advisor/profile'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) } as Response);
      if (urlStr.includes('/api/advisor/preferences'))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPreferences),
        } as Response);
      if (urlStr.includes('/api/advisor/memory-events'))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMemoryEvents),
        } as Response);
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    const { container } = renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
  });

  it('sends a message and clears input', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello advisor' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  it('shows retry on message send failure', async () => {
    global.fetch = makeFetchMock({ messageSendFail: true });
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=thread-1');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Message failed to send')).toBeInTheDocument();
    });
  });

  it('clears invalid threadId from URL', async () => {
    mockSearchParams = new URLSearchParams('tab=conversations&threadId=nonexistent');
    renderWithProviders(<AdvisorPage />);
    await waitFor(() => {
      expect(replaceFn).toHaveBeenCalledWith(
        expect.not.stringContaining('threadId=nonexistent'),
        expect.anything(),
      );
    });
  });
});
