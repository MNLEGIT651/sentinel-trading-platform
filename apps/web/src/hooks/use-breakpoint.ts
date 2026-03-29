'use client';

import { useState, useEffect } from 'react';

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Returns the current active Tailwind breakpoint.
 * SSR-safe: returns 'sm' on server, updates on mount.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('sm');

  useEffect(() => {
    function getBreakpoint(): Breakpoint {
      const width = window.innerWidth;
      if (width >= BREAKPOINTS['2xl']) return '2xl';
      if (width >= BREAKPOINTS.xl) return 'xl';
      if (width >= BREAKPOINTS.lg) return 'lg';
      if (width >= BREAKPOINTS.md) return 'md';
      return 'sm';
    }

    const handler = () => setBreakpoint(getBreakpoint());

    const queries = Object.values(BREAKPOINTS).map((value) => {
      const mql = window.matchMedia(`(min-width: ${value}px)`);
      mql.addEventListener('change', handler);
      return mql;
    });

    // Initial measurement via synthetic event dispatch
    handler();

    return () => {
      queries.forEach((mql) => mql.removeEventListener('change', handler));
    };
  }, []);

  return breakpoint;
}

/** Check if the current breakpoint is at least the given size */
export function useMinBreakpoint(target: Breakpoint): boolean {
  const current = useBreakpoint();
  const order: Breakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl'];
  return order.indexOf(current) >= order.indexOf(target);
}

export { BREAKPOINTS };
export type { Breakpoint };
