import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TrendingUp } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from './metric-card';

const meta = {
  title: 'Dashboard/MetricCard',
  component: MetricCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Portfolio Value',
    value: '$124,500.00',
  },
};

export const WithTooltip: Story = {
  args: {
    label: 'Sharpe Ratio',
    value: '1.42',
  },
};

export const WithIcon: Story = {
  render: () => (
    <MetricCard
      label="Total Return"
      value="$18,250.00"
      icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
    />
  ),
};

export const WithPositiveTrend: Story = {
  args: {
    label: 'Daily P&L',
    value: '+$342.50',
    change: 2.47,
  },
};

export const WithNegativeTrend: Story = {
  args: {
    label: 'Daily P&L',
    value: '-$128.00',
    change: -1.03,
  },
};

export const Loading: Story = {
  render: () => <MetricCard label="Portfolio Value" value={<Skeleton variant="metric" />} />,
};
