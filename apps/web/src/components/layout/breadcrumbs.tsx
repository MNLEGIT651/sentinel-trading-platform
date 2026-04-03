'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/markets': 'Markets',
  '/strategies': 'Strategies',
  '/signals': 'Signals',
  '/portfolio': 'Portfolio',
  '/orders': 'Orders',
  '/journal': 'Journal',
  '/advisor': 'Advisor',
  '/counterfactuals': 'What If',
  '/shadow-portfolios': 'Shadow Portfolios',
  '/regime': 'Regime',
  '/data-quality': 'Data Quality',
  '/replay': 'Replay',
  '/catalysts': 'Catalysts',
  '/backtest': 'Backtest',
  '/agents': 'Agents',
  '/experiment': 'Experiments',
  '/approvals': 'Approvals',
  '/workflows': 'Workflows',
  '/system-controls': 'Controls',
  '/autonomy': 'Autonomy',
  '/roles': 'Roles',
  '/audit-log': 'Audit Log',
  '/settings': 'Settings',
  '/recommendations': 'Recommendations',
  '/onboarding': 'Onboarding',
  '/onboarding/live-account': 'Live Account',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true for UUIDs, numeric IDs, and short hex IDs (≥6 chars) */
export function isDynamicSegment(segment: string): boolean {
  if (UUID_RE.test(segment)) return true;
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{6,}$/i.test(segment) && !/^[a-z-]+$/i.test(segment)) return true;
  return false;
}

/** Build breadcrumb entries from a pathname */
export function buildCrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;

    if (isDynamicSegment(segment)) {
      crumbs.push({ label: 'Details', href: currentPath });
    } else {
      const label = ROUTE_LABELS[currentPath] ?? segment.replace(/-/g, ' ');
      crumbs.push({ label, href: currentPath });
    }
  }

  return crumbs;
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();

  if (pathname === '/') return null;

  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-xs', className)}>
      <Link
        href="/"
        className="text-muted-foreground/60 hover:text-foreground transition-colors font-medium"
      >
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          {i === crumbs.length - 1 ? (
            <span className="text-foreground/80 font-medium capitalize">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground/60 hover:text-foreground transition-colors capitalize"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
