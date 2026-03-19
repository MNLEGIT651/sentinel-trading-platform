# Web Test Patterns Reference

Detailed patterns for writing Vitest tests in `apps/web/tests/`.

---

## Test Setup (`tests/setup.ts`)

Imported automatically by Vitest (configured in `vitest.config.ts`). Provides:

- `@testing-library/jest-dom/vitest` — extends `expect` with DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)
- `ResizeObserver` polyfill — required by `lightweight-charts` (TradingView charts used in the dashboard)
- `Element.prototype.getAnimations` polyfill — required by `@base-ui/react` ScrollArea

No need to import these in individual test files — they're global.

---

## Standard Component Test Pattern

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

// Mock Next.js navigation (required if component uses usePathname or useRouter)
vi.mock('next/navigation', () => ({
  usePathname: () => '/expected-path',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// Stub fetch to prevent real network calls
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('MyComponent', () => {
  it('renders without crashing', () => {
    const { container } = render(<MyComponent />);
    expect(container).toBeTruthy();
  });

  it('shows the expected label', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Label')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<MyComponent />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

---

## Available Query Methods (React Testing Library)

```tsx
// By visible text content
screen.getByText('Total Equity'); // throws if not found
screen.queryByText('Total Equity'); // returns null if not found
screen.getAllByText(/equity/i); // case-insensitive regex, returns array

// By role (accessible)
screen.getByRole('button', { name: 'Submit' });
screen.getByRole('heading', { level: 2 });

// By label (form elements)
screen.getByLabelText('Ticker Symbol');

// By test ID (last resort)
screen.getByTestId('equity-chart');
```

---

## Testing User Interactions

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('calls onSubmit when form is submitted', async () => {
  const onSubmit = vi.fn();
  render(<OrderForm onSubmit={onSubmit} />);

  // userEvent is more realistic than fireEvent (triggers real browser events)
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Ticker'), 'AAPL');
  await user.click(screen.getByRole('button', { name: 'Buy' }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'AAPL' }));
});
```

---

## Mocking Fetch Responses

Two patterns are used in the codebase depending on how many endpoints a component calls:

**Simple offline stub** (single component, no specific response needed):

```tsx
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
```

**URL-routing mock** (page that fetches from multiple endpoints):

```tsx
beforeEach(() => {
  global.fetch = vi.fn((url: string) => {
    if ((url as string).includes('/portfolio/account')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ cash: 95000, equity: 102500, buying_power: 47500 }),
      });
    }
    if ((url as string).includes('/portfolio/positions')) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    }
    return Promise.reject(new Error('unexpected fetch'));
  }) as typeof fetch;
});
```

Use `screen.findByText()` (returns a Promise) for content that appears after async data loading. Use `screen.getByText()` for content present on initial render.

**Note:** No existing tests mock the Supabase client directly — all page components fetch from the engine API via `fetch`. Supabase is only used for auth, which is not tested at the component level.

---

## Mocking Supabase

If a component directly uses the Supabase client (via `createClient` from `@/lib/supabase`), mock the module:

```tsx
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [{ id: '1', ticker: 'AAPL', direction: 'long', strength: 0.85 }],
                error: null,
              }),
          }),
        }),
      }),
    }),
  }),
}));
```

Most dashboard components use the EngineClient (via fetch) rather than Supabase directly — prefer the `vi.stubGlobal('fetch', ...)` approach for those.

---

## Testing Async Data Loading

```tsx
import { render, screen, waitFor } from '@testing-library/react';

it('shows error when fetch fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

  render(<SignalList />);

  // Wait for error state to appear
  await waitFor(() => {
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});

it('renders signals after successful load', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signals: [
          { ticker: 'AAPL', direction: 'long', strength: 0.9, strategy_name: 'sma_crossover' },
        ],
      }),
    }),
  );

  render(<SignalList />);

  // findBy* waits up to 1000ms by default
  expect(await screen.findByText('AAPL')).toBeInTheDocument();
});
```

---

## Component Props and Controlled State

```tsx
it('renders with provided props', () => {
  render(<PositionCard ticker="MSFT" quantity={100} avgEntryPrice={380.5} currentPrice={390.0} />);
  expect(screen.getByText('MSFT')).toBeInTheDocument();
  expect(screen.getByText('100')).toBeInTheDocument();
});
```

---

## File Organization

```
apps/web/tests/
├── setup.ts                          # global setup (auto-imported)
├── components/
│   ├── agents/AgentPanel.test.tsx
│   ├── backtest/BacktestForm.test.tsx
│   ├── portfolio/PositionCard.test.tsx
│   ├── signals/SignalList.test.tsx
│   └── strategies/StrategySelector.test.tsx
└── pages/
    ├── dashboard.test.tsx
    └── signals.test.tsx
```

Match the file structure under `src/` when naming test files.

---

## Running Tests

```bash
# All web tests
pnpm --filter web test

# Watch mode (re-runs on change)
pnpm --filter web test:watch

# Specific file
pnpm --filter web test -- tests/pages/dashboard.test.tsx

# With coverage
pnpm --filter web test -- --coverage
```
