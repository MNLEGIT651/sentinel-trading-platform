import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { OfflineBanner } from './offline-banner';

const meta = {
  title: 'UI/OfflineBanner',
  component: OfflineBanner,
  tags: ['autodocs'],
  argTypes: {
    service: {
      control: 'select',
      options: ['engine', 'agents'],
    },
  },
} satisfies Meta<typeof OfflineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    service: 'engine',
  },
};

export const EngineOffline: Story = {
  args: {
    service: 'engine',
  },
};

export const AgentsOffline: Story = {
  args: {
    service: 'agents',
  },
};

export const BothServices: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      <OfflineBanner service="engine" />
      <OfflineBanner service="agents" />
    </div>
  ),
};
