import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SetupProgress } from './setup-progress';

// Note: SetupProgress reads state exclusively from localStorage via useSyncExternalStore.
// It has no props. Each story uses a decorator to seed the correct localStorage state
// before the component mounts.
//
// The component returns null when dismissed (sentinel_setup_dismissed=true) or during SSR.

const meta = {
  title: 'Dashboard/SetupProgress',
  component: SetupProgress,
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
} satisfies Meta<typeof SetupProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Only the two always-complete steps are done (Connect API, View Dashboard). */
export const AllIncomplete: Story = {
  decorators: [
    (Story) => {
      localStorage.removeItem('sentinel_visited_signals');
      localStorage.removeItem('sentinel_visited_portfolio');
      localStorage.removeItem('sentinel_visited_strategies');
      localStorage.removeItem('sentinel_visited_alerts');
      localStorage.removeItem('sentinel_visited_settings');
      localStorage.removeItem('sentinel_setup_dismissed');
      return <Story />;
    },
  ],
};

/** Four of seven steps complete. */
export const PartiallyComplete: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem('sentinel_visited_signals', 'true');
      localStorage.setItem('sentinel_visited_portfolio', 'true');
      localStorage.removeItem('sentinel_visited_strategies');
      localStorage.removeItem('sentinel_visited_alerts');
      localStorage.removeItem('sentinel_visited_settings');
      localStorage.removeItem('sentinel_setup_dismissed');
      return <Story />;
    },
  ],
};

/** All seven steps complete — shows the celebration state. */
export const AllComplete: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem('sentinel_visited_signals', 'true');
      localStorage.setItem('sentinel_visited_portfolio', 'true');
      localStorage.setItem('sentinel_visited_strategies', 'true');
      localStorage.setItem('sentinel_visited_alerts', 'true');
      localStorage.setItem('sentinel_visited_settings', 'true');
      localStorage.removeItem('sentinel_setup_dismissed');
      return <Story />;
    },
  ],
};
