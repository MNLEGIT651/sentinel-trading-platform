import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CollapsibleCard } from './collapsible-card';

const meta = {
  title: 'UI/CollapsibleCard',
  component: CollapsibleCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollapsibleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CollapsedDefault: Story = {
  args: {
    title: 'Strategy Settings',
    defaultOpen: false,
    children: 'Risk tolerance: Medium · Max drawdown: 5% · Position size: 2%',
  },
};

export const Expanded: Story = {
  args: {
    title: 'Strategy Settings',
    defaultOpen: true,
    children: 'Risk tolerance: Medium · Max drawdown: 5% · Position size: 2%',
  },
};

export const WithSummary: Story = {
  args: {
    title: 'Risk Parameters',
    summary: '3 rules active',
    defaultOpen: false,
    children: 'Stop-loss: 2% · Take-profit: 6% · Max daily loss: $500',
  },
};

export const NoSummary: Story = {
  args: {
    title: 'Position Sizing',
    defaultOpen: false,
    children: 'Fixed: $1,000 per trade',
  },
};

export const WithHeaderAction: Story = {
  render: () => (
    <CollapsibleCard
      title="Active Positions"
      summary="4 open"
      headerAction={<span className="text-xs text-muted-foreground">Last updated 2m ago</span>}
    >
      <p className="text-sm text-muted-foreground">AAPL · TSLA · NVDA · MSFT</p>
    </CollapsibleCard>
  ),
};
