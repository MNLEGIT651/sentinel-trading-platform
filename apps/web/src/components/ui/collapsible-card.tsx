'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CollapsibleCardProps {
  title: string;
  summary?: string | undefined;
  defaultOpen?: boolean | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  headerAction?: React.ReactNode | undefined;
}

function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
  headerAction,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <CardHeader className="cursor-pointer select-none" onClick={() => setIsOpen((prev) => !prev)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {!isOpen && summary && <span className="text-xs text-muted-foreground">{summary}</span>}
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </div>
        </div>
      </CardHeader>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <CardContent>{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}

export { CollapsibleCard };
