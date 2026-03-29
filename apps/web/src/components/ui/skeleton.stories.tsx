import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Skeleton, SkeletonCard, SkeletonChart, SkeletonTable } from './skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
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
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'heading', 'card', 'chart', 'metric', 'table-row', 'avatar', 'button'],
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'text',
  },
};

export const Circle: Story = {
  args: {
    variant: 'avatar',
  },
};

export const Wide: Story = {
  args: {
    variant: 'chart',
  },
};

export const Metric: Story = {
  args: {
    variant: 'metric',
  },
};

export const CustomSize: Story = {
  args: {
    variant: 'text',
    className: 'h-6 w-48',
  },
};

export const MultiLine: Story = {
  args: {
    variant: 'text',
    lines: 4,
  },
};

export const CardSkeleton: Story = {
  render: () => <SkeletonCard />,
};

export const TableSkeleton: Story = {
  render: () => (
    <div className="w-full">
      <SkeletonTable rows={4} cols={4} />
    </div>
  ),
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};

export const ChartSkeleton: Story = {
  render: () => <SkeletonChart />,
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};
