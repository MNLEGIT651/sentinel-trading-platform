import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  change?: number;
  icon?: React.ReactNode;
}

export const MetricCard = memo(function MetricCard({
  label,
  value,
  change,
  icon,
}: MetricCardProps) {
  return (
    <Card className="@container/metric bg-card border-border card-interactive group/metric relative overflow-hidden">
      {/* Subtle top accent gradient */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <CardHeader className="flex flex-col items-start pb-1.5 @[10rem]/metric:flex-row @[10rem]/metric:items-center @[10rem]/metric:justify-between">
        <CardTitle className="text-heading-card">{label}</CardTitle>
        <div className="text-muted-foreground/50 transition-transform duration-200 group-hover/metric:scale-110 group-hover/metric:text-primary/70">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-data-primary animate-count-in">{value}</div>
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
