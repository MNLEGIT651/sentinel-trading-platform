import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  change?: number;
  icon?: React.ReactNode;
  hero?: boolean;
  className?: string;
}

export const MetricCard = memo(function MetricCard({
  label,
  value,
  change,
  icon,
  hero,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        '@container/metric bg-card border-border card-interactive group/metric relative overflow-hidden',
        className,
      )}
    >
      <CardHeader className="flex flex-col items-start pb-1.5 @[10rem]/metric:flex-row @[10rem]/metric:items-center @[10rem]/metric:justify-between">
        <CardTitle className="text-heading-card">{label}</CardTitle>
        <div className="text-muted-foreground/40 transition-colors duration-200 group-hover/metric:text-muted-foreground/60">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div
          className={
            hero ? 'text-data-hero animate-count-in' : 'text-data-primary animate-count-in'
          }
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
