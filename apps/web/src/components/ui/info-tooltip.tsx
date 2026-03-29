'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: string;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

function InfoTooltip({ content, className, iconClassName, side = 'top' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground',
          iconClassName,
        )}
        onClick={() => setIsVisible((prev) => !prev)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        aria-label="More information"
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={cn(
            'animate-tooltip absolute z-50 max-w-xs rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10',
            positionClasses[side],
          )}
        >
          {content}
        </div>
      )}
    </span>
  );
}

export { InfoTooltip };
