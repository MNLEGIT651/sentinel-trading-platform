import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StatusBadge } from './status-badge';

const meta = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['active', 'paused', 'error', 'success', 'warning', 'idle', 'pending'],
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { status: 'idle' },
};

export const Active: Story = {
  args: { status: 'active' },
};

export const Success: Story = {
  args: { status: 'success' },
};

export const Error: Story = {
  args: { status: 'error' },
};

export const Warning: Story = {
  args: { status: 'warning' },
};

export const Pending: Story = {
  args: { status: 'pending' },
};

export const Paused: Story = {
  args: { status: 'paused' },
};

export const WithCustomLabel: Story = {
  args: { status: 'active', label: 'Running' },
};

export const NoDot: Story = {
  args: { status: 'success', showDot: false },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['active', 'paused', 'error', 'success', 'warning', 'idle', 'pending'] as const).map(
        (status) => (
          <StatusBadge key={status} status={status} />
        ),
      )}
    </div>
  ),
};
