'use client';

import { useState, useEffect } from 'react';

/**
 * Simple boolean hook for mobile detection.
 * Mobile = viewport < 1024px (matches Tailwind lg breakpoint).
 * SSR-safe: returns false on server.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');

    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      setIsMobile(e.matches);
    }

    onChange(mql);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
