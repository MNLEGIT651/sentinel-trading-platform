'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const routes = [
  { href: '/', label: 'Overview' },
  { href: '/lab', label: 'Strategy Lab' },
  { href: '/controls', label: 'Controls' },
  { href: '/sources', label: 'Sources' },
] as const;

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="nav-grid" aria-label="Primary">
      {routes.map((route) => {
        const isActive = route.href === '/' ? pathname === '/' : pathname.startsWith(route.href);
        return (
          <Link
            key={route.href}
            href={route.href}
            className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
          >
            <span className="nav-link-label">{route.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
