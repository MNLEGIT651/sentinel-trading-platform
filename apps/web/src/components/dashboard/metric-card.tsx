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
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-data-primary">{value}</div>
        {change !== undefined && (
          <p className={cn('text-xs mt-1', change >= 0 ? 'text-profit' : 'text-loss')}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
});
