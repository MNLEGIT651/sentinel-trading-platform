import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InfoTooltip } from './info-tooltip';

// Note: InfoTooltip manages visibility via internal useState. The tooltip appears on hover or
// click of the info icon and dismisses on click-outside.

const meta = {
  title: 'UI/InfoTooltip',
  component: InfoTooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
  },
} satisfies Meta<typeof InfoTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This metric shows your total portfolio value.',
    side: 'top',
  },
};

export const LongText: Story = {
  args: {
    content:
      'The Sharpe ratio measures the performance of an investment compared to a risk-free asset, after adjusting for its risk. A higher Sharpe ratio indicates better risk-adjusted returns.',
    side: 'top',
  },
};

export const SideBottom: Story = {
  args: {
    content: 'Tooltip appears below the icon.',
    side: 'bottom',
  },
};

export const SideRight: Story = {
  args: {
    content: 'Tooltip appears to the right.',
    side: 'right',
  },
};

export const InContext: Story = {
  render: () => (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span>Sharpe Ratio</span>
      <InfoTooltip
        content="Risk-adjusted return metric. Values above 1 are generally considered acceptable."
        side="top"
      />
    </div>
  ),
};
