'use client';

import type { ElementType } from 'react';
import { Database } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ActionConfig {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface AnalysisEmptyStateProps {
  icon?: ElementType;
  title: string;
  description: string;
  action?: ActionConfig;
  secondaryAction?: ActionConfig;
  className?: string;
}

/**
 * Standard empty state for analysis/data pages that depend on agent cycles
 * or user-created data to populate. Explains what populates the data and
 * provides an action to trigger it.
 */
export function AnalysisEmptyState({
  icon: Icon = Database,
  title,
  description,
  action,
  secondaryAction,
  className,
}: AnalysisEmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}
    >
      <div className="rounded-full bg-muted/40 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{description}</p>
      <div className="flex items-center gap-3">
        {action &&
          (action.href ? (
            <Button asChild size="sm">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        {secondaryAction &&
          (secondaryAction.href ? (
            <Button asChild variant="outline" size="sm">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
