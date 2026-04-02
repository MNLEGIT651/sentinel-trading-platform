import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Bell,
  PieChart,
  ArrowUpDown,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const PRESETS = {
  'no-signals': {
    icon: Zap,
    title: 'No active signals',
    description: 'Signals appear here when strategies detect opportunities during market hours.',
  },
  'no-alerts': {
    icon: Bell,
    title: 'All clear',
    description:
      'No alerts right now. You\u2019ll see system and trading alerts here when they fire.',
  },
  'no-positions': {
    icon: PieChart,
    title: 'No open positions',
    description: 'Your portfolio is empty. Positions will appear here once trades are executed.',
  },
  'no-orders': {
    icon: ArrowUpDown,
    title: 'No orders yet',
    description: 'Order history will populate as you execute trades through the platform.',
  },
  'no-data': {
    icon: BarChart3,
    title: 'No data available',
    description:
      'Data for this view isn\u2019t available yet. Check back later or adjust your filters.',
  },
  'setup-required': {
    icon: Settings,
    title: 'Setup required',
    description: 'Complete your account setup to unlock this feature.',
  },
} as const;

type EmptyStatePreset = keyof typeof PRESETS;

interface EmptyStateWithPresetProps {
  preset: EmptyStatePreset;
  action?: EmptyStateProps['action'];
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/5 px-6 py-12 text-center animate-sentinel-in',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Icon className="h-6 w-6 text-primary/70" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyStatePreset({ preset, action, className }: EmptyStateWithPresetProps) {
  const config = PRESETS[preset];
  return (
    <EmptyState
      icon={config.icon}
      title={config.title}
      description={config.description}
      {...(action !== undefined ? { action } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
