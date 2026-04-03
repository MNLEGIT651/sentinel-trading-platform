import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Breadcrumbs,
  ROUTE_LABELS,
  isDynamicSegment,
  buildCrumbs,
} from '@/components/layout/breadcrumbs';

// Mock next/navigation
let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function setPathname(p: string) {
  mockPathname = p;
}

// ─── isDynamicSegment ────────────────────────────────────────────────
describe('isDynamicSegment', () => {
  it('detects UUID v4 strings', () => {
    expect(isDynamicSegment('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('detects numeric IDs', () => {
    expect(isDynamicSegment('42')).toBe(true);
    expect(isDynamicSegment('123456')).toBe(true);
  });

  it('detects long hex IDs', () => {
    expect(isDynamicSegment('abc123def456')).toBe(true);
  });

  it('rejects normal route segments', () => {
    expect(isDynamicSegment('portfolio')).toBe(false);
    expect(isDynamicSegment('audit-log')).toBe(false);
    expect(isDynamicSegment('shadow-portfolios')).toBe(false);
    expect(isDynamicSegment('data-quality')).toBe(false);
  });
});

// ─── buildCrumbs ─────────────────────────────────────────────────────
describe('buildCrumbs', () => {
  it('returns empty array for root path', () => {
    expect(buildCrumbs('/')).toEqual([]);
  });

  it('resolves a known static route', () => {
    const crumbs = buildCrumbs('/portfolio');
    expect(crumbs).toEqual([{ label: 'Portfolio', href: '/portfolio' }]);
  });

  it('shows parent label + "Details" for /recommendations/<uuid>', () => {
    const crumbs = buildCrumbs('/recommendations/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ label: 'Recommendations', href: '/recommendations' });
    expect(crumbs[1]).toEqual({
      label: 'Details',
      href: '/recommendations/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });
  });

  it('shows parent label + "Details" for /experiment/<numeric-id>', () => {
    const crumbs = buildCrumbs('/experiment/99');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ label: 'Experiments', href: '/experiment' });
    expect(crumbs[1]).toEqual({ label: 'Details', href: '/experiment/99' });
  });

  it('handles nested static routes like /onboarding/live-account', () => {
    const crumbs = buildCrumbs('/onboarding/live-account');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ label: 'Onboarding', href: '/onboarding' });
    expect(crumbs[1]).toEqual({ label: 'Live Account', href: '/onboarding/live-account' });
  });

  it('falls back to formatted segment name for unknown routes', () => {
    const crumbs = buildCrumbs('/some-unknown-route');
    expect(crumbs).toEqual([{ label: 'some unknown route', href: '/some-unknown-route' }]);
  });
});

// ─── ROUTE_LABELS completeness ───────────────────────────────────────
describe('ROUTE_LABELS', () => {
  const expectedRoutes = [
    '/',
    '/markets',
    '/strategies',
    '/signals',
    '/portfolio',
    '/orders',
    '/journal',
    '/advisor',
    '/counterfactuals',
    '/shadow-portfolios',
    '/regime',
    '/data-quality',
    '/replay',
    '/catalysts',
    '/backtest',
    '/agents',
    '/experiment',
    '/approvals',
    '/workflows',
    '/system-controls',
    '/autonomy',
    '/roles',
    '/audit-log',
    '/settings',
    '/recommendations',
  ];

  it.each(expectedRoutes)('has a label for %s', (route) => {
    expect(ROUTE_LABELS[route]).toBeDefined();
    expect(ROUTE_LABELS[route].length).toBeGreaterThan(0);
  });

  it('contains at least 25 entries', () => {
    expect(Object.keys(ROUTE_LABELS).length).toBeGreaterThanOrEqual(25);
  });
});

// ─── Breadcrumbs component rendering ─────────────────────────────────
describe('Breadcrumbs component', () => {
  it('renders nothing for the root path', () => {
    setPathname('/');
    const { container } = render(<Breadcrumbs />);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders "Home > Portfolio" for /portfolio', () => {
    setPathname('/portfolio');
    render(<Breadcrumbs />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Portfolio')).toBeDefined();
  });

  it('renders "Home > Recommendations > Details" for /recommendations/<uuid>', () => {
    setPathname('/recommendations/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    render(<Breadcrumbs />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Recommendations')).toBeDefined();
    expect(screen.getByText('Details')).toBeDefined();
  });

  it('renders "Home > Experiments > Details" for /experiment/<id>', () => {
    setPathname('/experiment/42');
    render(<Breadcrumbs />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Experiments')).toBeDefined();
    expect(screen.getByText('Details')).toBeDefined();
  });

  it('makes the parent a link and the last crumb plain text', () => {
    setPathname('/recommendations/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    render(<Breadcrumbs />);
    const recommendationsLink = screen.getByText('Recommendations');
    expect(recommendationsLink.closest('a')).toBeDefined();
    expect(recommendationsLink.closest('a')?.getAttribute('href')).toBe('/recommendations');

    const details = screen.getByText('Details');
    expect(details.tagName).toBe('SPAN');
  });

  it('has an accessible nav landmark', () => {
    setPathname('/portfolio');
    render(<Breadcrumbs />);
    expect(screen.getByLabelText('Breadcrumb')).toBeDefined();
  });
});
