import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPathname = vi.fn(() => '/');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Components under test
// ---------------------------------------------------------------------------

import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';

// ===========================================================================
// Sidebar tests
// ===========================================================================

describe('Sidebar accessibility', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
  });

  it('renders with nav element and aria-label', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
  });

  it('active link has aria-current="page"', () => {
    mockPathname.mockReturnValue('/portfolio');
    render(<Sidebar />);
    const link = screen.getByRole('link', { name: /^Portfolio$/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('inactive link does not have aria-current', () => {
    mockPathname.mockReturnValue('/');
    render(<Sidebar />);
    const link = screen.getByRole('link', { name: /Markets/i });
    expect(link).not.toHaveAttribute('aria-current');
  });

  it('collapse button has aria-expanded when expanded', () => {
    render(<Sidebar collapsed={false} />);
    const btn = screen.getByRole('button', { name: /Collapse sidebar/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapse button has aria-expanded when collapsed', () => {
    render(<Sidebar collapsed={true} />);
    const btn = screen.getByRole('button', { name: /Expand sidebar/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('nav sections have group role with aria-label', () => {
    render(<Sidebar />);
    const groups = screen.getAllByRole('group');
    expect(groups.length).toBe(2);
    expect(groups[0]).toHaveAttribute('aria-label', 'Core Workflows');
  });
});

// ===========================================================================
// MobileNav tests
// ===========================================================================

describe('MobileNav accessibility', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
  });

  it('has aria-label on nav element', () => {
    render(<MobileNav />);
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(nav).toBeInTheDocument();
  });

  it('active item has aria-current="page"', () => {
    mockPathname.mockReturnValue('/');
    render(<MobileNav />);
    const link = screen.getByRole('link', { name: /Dashboard/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('inactive item does not have aria-current', () => {
    mockPathname.mockReturnValue('/');
    render(<MobileNav />);
    const link = screen.getByRole('link', { name: /Markets/i });
    expect(link).not.toHaveAttribute('aria-current');
  });
});
