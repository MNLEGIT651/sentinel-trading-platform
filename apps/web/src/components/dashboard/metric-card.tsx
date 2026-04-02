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
      <CardHeader className="flex flex-col items-start pb-2 @[10rem]/metric:flex-row @[10rem]/metric:items-center @[10rem]/metric:justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="transition-transform duration-200 group-hover/metric:scale-110">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-data-primary">{value}</div>
        {change !== undefined && (
          <p className={cn('text-xs mt-1 font-medium', change >= 0 ? 'text-profit' : 'text-loss')}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
});
