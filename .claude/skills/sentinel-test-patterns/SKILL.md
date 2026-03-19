---
name: sentinel-test-patterns
description: This skill should be used when writing, fixing, or understanding tests in the Sentinel trading platform — including "write a test", "add tests for", "fix failing test", "unit test", "integration test", "test coverage", "mock the engine", "mock Supabase", or any time files in apps/engine/tests/ or apps/web/tests/ are created or modified. Apply automatically when implementing new features that need test coverage.
user-invocable: false
---

# Sentinel Test Patterns

The platform has two test setups that do not share patterns — use the right one for the code being tested.

| Setup               | Framework                      | Location             | Run Command                                           |
| ------------------- | ------------------------------ | -------------------- | ----------------------------------------------------- |
| Engine (Python)     | pytest + FastAPI TestClient    | `apps/engine/tests/` | `.venv/Scripts/python -m pytest apps/engine/tests -x` |
| Web (TypeScript)    | Vitest + React Testing Library | `apps/web/tests/`    | `pnpm --filter web test`                              |
| Agents (TypeScript) | Vitest                         | `apps/agents/tests/` | `pnpm --filter agents test`                           |

## Decision: Which Test to Write

**Engine unit test** — for: FastAPI routes, strategy logic, indicators, risk calculations, broker behavior, Pydantic schema validation. No external services needed.

**Engine integration test** — for: full request → response → side-effect chains that need the real app running against stub services. Rarely needed; use unit tests for most cases.

**Web component test** — for: React components rendering, user interactions, data loading states. Mock all API calls with `vi.stubGlobal('fetch', ...)`.

**Web page test** — for: full page renders, navigation, layout checks. Keep minimal — test the component, not the page.

## Engine Test Quick Reference

```python
# Standard imports for a route test
import pytest
from fastapi.testclient import TestClient
from src.api.main import app

@pytest.fixture
def client():
    return TestClient(app)

class TestMyRoute:
    def test_happy_path(self, client):
        resp = client.get("/api/v1/my-route")
        assert resp.status_code == 200
        data = resp.json()
        assert "expected_field" in data
```

Key points:

- Group related tests in `class Test<FeatureName>` — no inheritance needed
- The `client` fixture creates a new `TestClient(app)` — stateless between tests
- The root `conftest.py` has an autouse `_stub_required_env` fixture that supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — no need to set these manually
- File naming: `tests/unit/test_<module>.py` mirroring `src/<module>.py`

For tests that call external HTTP (Polygon, Alpaca), use `respx` to mock — see `references/engine-test-patterns.md`.

## Web Test Quick Reference

```tsx
// Standard imports for a component test
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

// Mock Next.js router (required for any component using navigation)
vi.mock('next/navigation', () => ({
  usePathname: () => '/my-path',
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock fetch for offline/controlled testing
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
});
```

Key points:

- `@testing-library/jest-dom/vitest` is imported in `tests/setup.ts` — `toBeInTheDocument()` is available globally
- `ResizeObserver` and `getAnimations` are polyfilled in setup — no need to add them per-test
- File location: `tests/components/<feature>/<Component>.test.tsx` or `tests/pages/<page>.test.tsx`
- No Supabase client mock needed at the component level — most components use hooks that call `fetch`, which is stubbed via `vi.stubGlobal`

## Running Specific Tests

```bash
# Engine: single file
.venv/Scripts/python -m pytest apps/engine/tests/unit/test_strategy_routes.py -v

# Engine: single test
.venv/Scripts/python -m pytest apps/engine/tests/unit/test_strategy_routes.py::TestListStrategies::test_returns_all_strategies -v

# Engine: with coverage
.venv/Scripts/python -m pytest apps/engine/tests --cov=src --cov-report=term-missing

# Web: single file
pnpm --filter web test -- tests/pages/dashboard.test.tsx

# Web: watch mode
pnpm --filter web test:watch
```

## Additional Resources

- **`references/engine-test-patterns.md`** — respx HTTP mocking, async fixtures, integration test setup, conftest fixtures
- **`references/web-test-patterns.md`** — user interaction testing, async data fetching, mocking Supabase hooks
