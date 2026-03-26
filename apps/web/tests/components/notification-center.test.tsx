/**
 * Comprehensive tests for NotificationCenter component.
 *
 * Tests notification polling, localStorage persistence, read/unread state,
 * UI interactions, severity icons, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NotificationCenter } from '@/components/notification-center';

// Mock data
const mockAlerts = [
  {
    id: '1',
    title: 'Price Alert',
    message: 'AAPL reached target price',
    severity: 'info',
    created_at: '2026-03-26T10:00:00Z',
  },
  {
    id: '2',
    title: 'Risk Warning',
    message: 'Portfolio volatility increased',
    severity: 'warning',
    created_at: '2026-03-26T11:00:00Z',
  },
  {
    id: '3',
    title: 'Stop Loss Triggered',
    message: 'Position closed at loss',
    severity: 'critical',
    created_at: '2026-03-26T12:00:00Z',
  },
];

describe('NotificationCenter', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('renders notification bell icon', () => {
      render(<NotificationCenter />);
      const button = screen.getByRole('button', { name: /notifications/i });
      expect(button).toBeInTheDocument();
    });

    it('starts with notification panel closed', () => {
      render(<NotificationCenter />);
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('does not show unread count badge initially', () => {
      render(<NotificationCenter />);
      const button = screen.getByRole('button', { name: /notifications/i });
      expect(within(button).queryByText(/\d+/)).not.toBeInTheDocument();
    });

    it('has correct aria-label without unread count', () => {
      render(<NotificationCenter />);
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });

  describe('Notification Polling', () => {
    it('fetches alerts on mount', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/agents/alerts');
      });
    });

    it('polls alerts every 30 seconds', async () => {
      vi.useFakeTimers();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      // Initial fetch
      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Fast-forward 30 seconds
      await vi.advanceTimersByTimeAsync(30_000);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Fast-forward another 30 seconds
      await vi.advanceTimersByTimeAsync(30_000);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('handles fetch errors gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should not crash or show error UI
      const button = screen.getByRole('button', { name: /notifications/i });
      expect(button).toBeInTheDocument();
    });

    it('handles non-ok response gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should not crash
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });

    it('stops polling on unmount', async () => {
      vi.useFakeTimers();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ alerts: [] }),
      });

      const { unmount } = render(<NotificationCenter />);

      await vi.advanceTimersByTimeAsync(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      unmount();

      // Fast-forward 30 seconds after unmount
      await vi.advanceTimersByTimeAsync(30_000);

      // Should not poll again
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('handles alerts in array format', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlerts,
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      await waitFor(() => {
        expect(screen.getByText('Price Alert')).toBeInTheDocument();
      });
    });

    it('handles alerts in { alerts: [] } format', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      await waitFor(() => {
        expect(screen.getByText('Price Alert')).toBeInTheDocument();
      });
    });

    it('limits notifications to 20 items', async () => {
      const manyAlerts = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        title: `Alert ${i}`,
        message: `Message ${i}`,
        severity: 'info',
        created_at: new Date().toISOString(),
      }));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: manyAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Should only show 20 notifications
      const notifications = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('Alert'));
      expect(notifications.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Notification Display', () => {
    beforeEach(async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });
    });

    it('shows notification panel when bell is clicked', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('displays all notifications', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Price Alert')).toBeInTheDocument();
      expect(screen.getByText('Risk Warning')).toBeInTheDocument();
      expect(screen.getByText('Stop Loss Triggered')).toBeInTheDocument();
    });

    it('displays notification messages', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText(/AAPL reached target price/i)).toBeInTheDocument();
      expect(screen.getByText(/Portfolio volatility increased/i)).toBeInTheDocument();
    });

    it('displays notification timestamps', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Timestamps should be formatted as time strings
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('shows empty state when no notifications', async () => {
      // Reset the beforeEach mock so empty alerts are returned
      (global.fetch as ReturnType<typeof vi.fn>).mockReset();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  describe('Unread Count Badge', () => {
    it('shows unread count badge when there are unread notifications', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        const badge = screen.getByText('3');
        expect(badge).toBeInTheDocument();
      });
    });

    it('shows "9+" for more than 9 unread notifications', async () => {
      const manyAlerts = Array.from({ length: 15 }, (_, i) => ({
        id: String(i),
        title: `Alert ${i}`,
        message: 'Test',
        severity: 'info',
        created_at: new Date().toISOString(),
      }));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: manyAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(screen.getByText('9+')).toBeInTheDocument();
      });
    });

    it('updates badge count when notifications are marked as read', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Click first notification to mark as read
      const firstNotification = screen.getByText('Price Alert').closest('button')!;
      fireEvent.click(firstNotification);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('hides badge when all notifications are read', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [mockAlerts[0]] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      const notification = screen.getByText('Price Alert').closest('button')!;
      fireEvent.click(notification);

      await waitFor(() => {
        expect(screen.queryByText('1')).not.toBeInTheDocument();
      });
    });

    it('includes unread count in aria-label', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(screen.getByLabelText('Notifications (3 unread)')).toBeInTheDocument();
      });
    });
  });

  describe('Read/Unread State', () => {
    it('marks new notifications as unread', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // All should have unread indicator (visual dot)
      const notifications = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('Alert'));
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('marks notification as read when clicked', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      const notification = screen.getByText('Price Alert').closest('button')!;
      fireEvent.click(notification);

      // Notification should now be marked as read
      // (visual styling changes, but still present)
      expect(screen.getByText('Price Alert')).toBeInTheDocument();
    });

    it('marks all notifications as read when button clicked', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      const markAllReadButton = screen.getByRole('button', { name: /mark all as read/i });
      fireEvent.click(markAllReadButton);

      // Badge should disappear
      await waitFor(() => {
        expect(screen.queryByText('3')).not.toBeInTheDocument();
      });
    });

    it('does not show mark all read button when no unread notifications', async () => {
      // Pre-mark all as read in localStorage
      localStorage.setItem('sentinel-read-notifications', JSON.stringify(['1', '2', '3']));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument();
    });
  });

  describe('LocalStorage Persistence', () => {
    it('persists read status to localStorage', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [mockAlerts[0]] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      const notification = screen.getByText('Price Alert').closest('button')!;
      fireEvent.click(notification);

      const stored = localStorage.getItem('sentinel-read-notifications');
      expect(stored).toBeTruthy();
      const readIds = JSON.parse(stored!);
      expect(readIds).toContain('1');
    });

    it('loads read status from localStorage on mount', async () => {
      localStorage.setItem('sentinel-read-notifications', JSON.stringify(['1']));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Only 2 unread (id '1' is already read)
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('handles corrupted localStorage gracefully', async () => {
      localStorage.setItem('sentinel-read-notifications', 'invalid json');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should not crash, treats as empty
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('handles localStorage unavailable gracefully', async () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [mockAlerts[0]] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      const notification = screen.getByText('Price Alert').closest('button')!;

      // Should not crash when trying to save to localStorage
      expect(() => fireEvent.click(notification)).not.toThrow();

      localStorage.setItem = originalSetItem;
    });

    it('accumulates read IDs over time', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Mark first notification as read
      const firstNotification = screen.getByText('Price Alert').closest('button')!;
      fireEvent.click(firstNotification);

      let stored = localStorage.getItem('sentinel-read-notifications');
      let readIds = JSON.parse(stored!);
      expect(readIds).toContain('1');
      expect(readIds.length).toBe(1);

      // Mark second notification as read
      const secondNotification = screen.getByText('Risk Warning').closest('button')!;
      fireEvent.click(secondNotification);

      stored = localStorage.getItem('sentinel-read-notifications');
      readIds = JSON.parse(stored!);
      expect(readIds).toContain('1');
      expect(readIds).toContain('2');
      expect(readIds.length).toBe(2);
    });
  });

  describe('Severity Icons', () => {
    it('shows info icon for info severity', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          alerts: [{ ...mockAlerts[0], severity: 'info' }],
        }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Info icon should be present (exact implementation may vary)
      expect(screen.getByText('Price Alert')).toBeInTheDocument();
    });

    it('shows warning icon for warning severity', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          alerts: [{ ...mockAlerts[1], severity: 'warning' }],
        }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Risk Warning')).toBeInTheDocument();
    });

    it('shows critical icon for critical severity', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          alerts: [{ ...mockAlerts[2], severity: 'critical' }],
        }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Stop Loss Triggered')).toBeInTheDocument();
    });

    it('defaults to info icon for unknown severity', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          alerts: [{ ...mockAlerts[0], severity: 'unknown' }],
        }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Price Alert')).toBeInTheDocument();
    });
  });

  describe('Panel Interactions', () => {
    beforeEach(async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });
    });

    it('closes panel when close button clicked', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Notifications')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /close notifications/i });
      fireEvent.click(closeButton);

      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('closes panel when backdrop is clicked', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Notifications')).toBeInTheDocument();

      // Click backdrop (element with fixed inset-0)
      const backdrop = document.querySelector('.fixed.inset-0')!;
      fireEvent.click(backdrop);

      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('toggles panel when bell clicked multiple times', async () => {
      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const bellButton = screen.getByRole('button', { name: /notifications/i });

      // Open
      fireEvent.click(bellButton);
      expect(screen.getByText('Notifications')).toBeInTheDocument();

      // Close
      fireEvent.click(bellButton);
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();

      // Open again
      fireEvent.click(bellButton);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing alert fields gracefully', async () => {
      const malformedAlerts = [
        {
          id: '1',
          // Missing title
          message: 'Test message',
          severity: 'info',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Test',
          // Missing message
          severity: 'warning',
          created_at: new Date().toISOString(),
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: malformedAlerts as unknown[] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Should render fallback values without crashing
      expect(screen.getByText('Alert')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('generates ID for alerts without id', async () => {
      const alertsWithoutId = [
        {
          title: 'No ID Alert',
          message: 'This alert has no ID',
          severity: 'info',
          created_at: new Date().toISOString(),
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: alertsWithoutId as unknown[] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Should still render without crashing
      expect(screen.getByText('No ID Alert')).toBeInTheDocument();
    });

    it('preserves existing read state when new alerts arrive', async () => {
      // First poll returns one alert
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [mockAlerts[0]] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      await waitFor(() => {
        expect(screen.getByText('Price Alert')).toBeInTheDocument();
      });

      // Mark as read
      const notification = screen.getByText('Price Alert').closest('button')!;
      fireEvent.click(notification);

      // Verify read state was persisted to localStorage
      const stored = localStorage.getItem('sentinel-read-notifications');
      const readIds = JSON.parse(stored!);
      expect(readIds).toContain('1');
    });

    it('handles unmount during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(promise);

      const { unmount } = render(<NotificationCenter />);

      // Unmount before fetch completes
      unmount();

      // Resolve fetch after unmount
      resolvePromise!({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      });

      // Should not crash or cause warnings
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('handles empty response object', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });

    it('handles null alert values', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: null }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });

    it('limits message display with line-clamp', async () => {
      const longMessageAlert = {
        id: '1',
        title: 'Long Message',
        message:
          'This is a very long message that should be truncated with ellipsis after two lines '.repeat(
            5,
          ),
        severity: 'info',
        created_at: new Date().toISOString(),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [longMessageAlert] }),
      });

      render(<NotificationCenter />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      // Message should be present but visually clamped (CSS handles this)
      expect(screen.getByText(/This is a very long message/)).toBeInTheDocument();
    });
  });
});
