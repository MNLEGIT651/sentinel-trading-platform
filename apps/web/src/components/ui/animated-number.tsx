'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

function AnimatedNumber({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startValue = previousValue.current;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={cn('animate-count-in tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export { AnimatedNumber };
