import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  change?: number;
  icon?: React.ReactNode;
  emphasis?: 'default' | 'hero';
}

export const MetricCard = memo(function MetricCard({
  label,
  value,
  change,
  icon,
  emphasis = 'default',
}: MetricCardProps) {
  return (
    <Card className="@container/metric border-border bg-card card-interactive">
      <CardHeader className="flex flex-col items-start pb-1.5 @[10rem]/metric:flex-row @[10rem]/metric:items-center @[10rem]/metric:justify-between">
        <CardTitle className="text-heading-card">{label}</CardTitle>
        <div className="text-muted-foreground/65">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div
          className={cn(
            emphasis === 'hero'
              ? 'text-[2rem] leading-9 sm:text-[2.25rem] sm:leading-10'
              : 'text-data-primary',
            'font-mono font-semibold tabular-nums tracking-tight animate-count-in',
          )}
        >
          {value}
        </div>
        {change !== undefined && (
          <p
            className={cn(
              'text-xs font-medium font-mono',
              change >= 0 ? 'text-profit' : 'text-loss',
            )}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
});
