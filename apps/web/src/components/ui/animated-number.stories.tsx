import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AnimatedNumber } from './animated-number';

// Note: AnimatedNumber uses requestAnimationFrame internally to animate from 0 to the target
// value. The animation plays on mount and whenever `value` changes.

const meta = {
  title: 'UI/AnimatedNumber',
  component: AnimatedNumber,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AnimatedNumber>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 1234,
  },
};

export const Currency: Story = {
  args: {
    value: 124500.5,
    prefix: '$',
    decimals: 2,
  },
};

export const Percentage: Story = {
  args: {
    value: 87.5,
    suffix: '%',
    decimals: 1,
  },
};

export const LargeNumber: Story = {
  args: {
    value: 1_000_000,
    decimals: 0,
  },
};

export const Zero: Story = {
  args: {
    value: 0,
    decimals: 2,
    prefix: '$',
  },
};

export const NegativeValue: Story = {
  args: {
    value: -342.5,
    prefix: '$',
    decimals: 2,
  },
};
