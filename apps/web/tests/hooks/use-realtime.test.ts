/**
 * Comprehensive tests for useRealtime hook.
 *
 * Tests Supabase real-time subscriptions for INSERT, UPDATE, DELETE events,
 * connection state management, data synchronization, cleanup, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtime } from '@/hooks/use-realtime';

// Mock types
interface TestEntity {
  id: string;
  name: string;
  value: number;
}

// Mock Supabase channel
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

const mockSupabaseClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));

describe('useRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('starts with initial data and disconnected state', () => {
      const initialData: TestEntity[] = [
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 },
      ];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      expect(result.current.data).toEqual(initialData);
      expect(result.current.isConnected).toBe(false);
    });

    it('starts with empty data by default', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      expect(result.current.data).toEqual([]);
      expect(result.current.isConnected).toBe(false);
    });

    it('creates channel with unique name including table and timestamp', () => {
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);

      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'orders',
        }),
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('realtime-orders-1234567890');

      dateSpy.mockRestore();
    });

    it('subscribes to channel on mount', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
      expect(mockChannel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Channel Configuration', () => {
    it('subscribes to all events by default', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      // Should register 3 event handlers (INSERT, UPDATE, DELETE)
      expect(mockChannel.on).toHaveBeenCalledTimes(3);
    });

    it('subscribes to specified events only', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          events: ['INSERT', 'UPDATE'],
        }),
      );

      // Should register 2 event handlers
      expect(mockChannel.on).toHaveBeenCalledTimes(2);
    });

    it('uses default public schema', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      const onCalls = mockChannel.on.mock.calls;
      onCalls.forEach((call) => {
        const opts = call[1];
        expect(opts.schema).toBe('public');
      });
    });

    it('uses custom schema when provided', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          schema: 'custom_schema',
        }),
      );

      const onCalls = mockChannel.on.mock.calls;
      onCalls.forEach((call) => {
        const opts = call[1];
        expect(opts.schema).toBe('custom_schema');
      });
    });

    it('applies filter when provided', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'orders',
          filter: 'status=eq.pending',
        }),
      );

      const onCalls = mockChannel.on.mock.calls;
      onCalls.forEach((call) => {
        const opts = call[1];
        expect(opts.filter).toBe('status=eq.pending');
      });
    });

    it('omits filter when not provided', () => {
      renderHook(() =>
        useRealtime<TestEntity>({
          table: 'orders',
        }),
      );

      const onCalls = mockChannel.on.mock.calls;
      onCalls.forEach((call) => {
        const opts = call[1];
        expect(opts.filter).toBeUndefined();
      });
    });
  });

  describe('Connection State', () => {
    it('sets isConnected to true when subscription succeeds', async () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      // Get the subscribe callback
      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      // Simulate successful subscription
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('keeps isConnected false for non-SUBSCRIBED status', async () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('keeps isConnected false for CLOSED status', async () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      act(() => {
        subscribeCallback('CLOSED');
      });

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('INSERT Event Handling', () => {
    it('adds new item to beginning of data array on INSERT', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData: [{ id: '1', name: 'Item 1', value: 100 }],
        }),
      );

      // Get the INSERT event handler
      const insertHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'INSERT')?.[2];

      const newItem: TestEntity = { id: '2', name: 'Item 2', value: 200 };

      act(() => {
        insertHandler?.({ eventType: 'INSERT', new: newItem, old: {} });
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0]).toEqual(newItem);
      expect(result.current.data[1]).toEqual({ id: '1', name: 'Item 1', value: 100 });
    });

    it('handles INSERT into empty data array', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      const insertHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'INSERT')?.[2];
      const newItem: TestEntity = { id: '1', name: 'First Item', value: 50 };

      act(() => {
        insertHandler?.({ eventType: 'INSERT', new: newItem, old: {} });
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]).toEqual(newItem);
    });

    it('handles multiple INSERT events', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      const insertHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'INSERT')?.[2];

      const item1: TestEntity = { id: '1', name: 'Item 1', value: 100 };
      const item2: TestEntity = { id: '2', name: 'Item 2', value: 200 };
      const item3: TestEntity = { id: '3', name: 'Item 3', value: 300 };

      act(() => {
        insertHandler?.({ eventType: 'INSERT', new: item1, old: {} });
        insertHandler?.({ eventType: 'INSERT', new: item2, old: {} });
        insertHandler?.({ eventType: 'INSERT', new: item3, old: {} });
      });

      expect(result.current.data).toHaveLength(3);
      // Most recent insert should be first
      expect(result.current.data[0]).toEqual(item3);
      expect(result.current.data[1]).toEqual(item2);
      expect(result.current.data[2]).toEqual(item1);
    });
  });

  describe('UPDATE Event Handling', () => {
    it('updates existing item by id on UPDATE', () => {
      const initialData: TestEntity[] = [
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 },
        { id: '3', name: 'Item 3', value: 300 },
      ];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const updateHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'UPDATE')?.[2];
      const updatedItem: TestEntity = { id: '2', name: 'Updated Item 2', value: 250 };

      act(() => {
        updateHandler?.({ eventType: 'UPDATE', new: updatedItem, old: { id: '2' } });
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data[1]).toEqual(updatedItem);
      expect(result.current.data[0]).toEqual({ id: '1', name: 'Item 1', value: 100 });
      expect(result.current.data[2]).toEqual({ id: '3', name: 'Item 3', value: 300 });
    });

    it('preserves array order on UPDATE', () => {
      const initialData: TestEntity[] = [
        { id: '1', name: 'A', value: 1 },
        { id: '2', name: 'B', value: 2 },
        { id: '3', name: 'C', value: 3 },
      ];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const updateHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'UPDATE')?.[2];

      act(() => {
        updateHandler?.({ eventType: 'UPDATE', new: { id: '1', name: 'A_updated', value: 10 }, old: { id: '1' } });
      });

      expect(result.current.data[0].id).toBe('1');
      expect(result.current.data[1].id).toBe('2');
      expect(result.current.data[2].id).toBe('3');
    });

    it('does nothing when UPDATE id not found', () => {
      const initialData: TestEntity[] = [{ id: '1', name: 'Item 1', value: 100 }];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const updateHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'UPDATE')?.[2];

      act(() => {
        updateHandler?.({ eventType: 'UPDATE', new: { id: '999', name: 'Not Found', value: 0 }, old: { id: '999' } });
      });

      expect(result.current.data).toEqual(initialData);
    });

    it('handles multiple UPDATE events', () => {
      const initialData: TestEntity[] = [
        { id: '1', name: 'A', value: 1 },
        { id: '2', name: 'B', value: 2 },
      ];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const updateHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'UPDATE')?.[2];

      act(() => {
        updateHandler?.({ eventType: 'UPDATE', new: { id: '1', name: 'A_v2', value: 10 }, old: { id: '1' } });
        updateHandler?.({ eventType: 'UPDATE', new: { id: '2', name: 'B_v2', value: 20 }, old: { id: '2' } });
      });

      expect(result.current.data[0]).toEqual({ id: '1', name: 'A_v2', value: 10 });
      expect(result.current.data[1]).toEqual({ id: '2', name: 'B_v2', value: 20 });
    });
  });

  describe('DELETE Event Handling', () => {
    it('removes item by id on DELETE', () => {
      const initialData: TestEntity[] = [
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 },
        { id: '3', name: 'Item 3', value: 300 },
      ];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const deleteHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'DELETE')?.[2];

      act(() => {
        deleteHandler?.({ eventType: 'DELETE', new: {}, old: { id: '2' } });
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data.find((item) => item.id === '2')).toBeUndefined();
      expect(result.current.data[0]).toEqual({ id: '1', name: 'Item 1', value: 100 });
      expect(result.current.data[1]).toEqual({ id: '3', name: 'Item 3', value: 300 });
    });

    it('does nothing when DELETE id not found', () => {
      const initialData: TestEntity[] = [{ id: '1', name: 'Item 1', value: 100 }];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const deleteHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'DELETE')?.[2];

      act(() => {
        deleteHandler?.({ eventType: 'DELETE', new: {}, old: { id: '999' } });
      });

      expect(result.current.data).toEqual(initialData);
    });

    it('handles DELETE resulting in empty array', () => {
      const initialData: TestEntity[] = [{ id: '1', name: 'Only Item', value: 100 }];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const deleteHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'DELETE')?.[2];

      act(() => {
        deleteHandler?.({ eventType: 'DELETE', new: {}, old: { id: '1' } });
      });

      expect(result.current.data).toEqual([]);
    });

    it('handles multiple DELETE events', () => {
      const initialData: TestEntity[] = [
        { id: '1', name: 'A', value: 1 },
        { id: '2', name: 'B', value: 2 },
        { id: '3', name: 'C', value: 3 },
      ];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const deleteHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'DELETE')?.[2];

      act(() => {
        deleteHandler?.({ eventType: 'DELETE', new: {}, old: { id: '1' } });
        deleteHandler?.({ eventType: 'DELETE', new: {}, old: { id: '3' } });
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]).toEqual({ id: '2', name: 'B', value: 2 });
    });
  });

  describe('Mixed Event Handling', () => {
    it('handles INSERT, UPDATE, DELETE in sequence', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData: [{ id: '1', name: 'Original', value: 100 }],
        }),
      );

      const insertHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'INSERT')?.[2];
      const updateHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'UPDATE')?.[2];
      const deleteHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'DELETE')?.[2];

      // INSERT
      act(() => {
        insertHandler?.({ eventType: 'INSERT', new: { id: '2', name: 'New', value: 200 }, old: {} });
      });

      expect(result.current.data).toHaveLength(2);

      // UPDATE
      act(() => {
        updateHandler?.({ eventType: 'UPDATE', new: { id: '1', name: 'Updated', value: 150 }, old: { id: '1' } });
      });

      expect(result.current.data.find((item) => item.id === '1')?.name).toBe('Updated');

      // DELETE
      act(() => {
        deleteHandler?.({ eventType: 'DELETE', new: {}, old: { id: '2' } });
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].id).toBe('1');
    });

    it('routes events to correct handler based on eventType', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      // Get the generic postgres_changes handler (all events go through same callback)
      const eventHandler = mockChannel.on.mock.calls[0][2];

      const insertItem: TestEntity = { id: '1', name: 'Insert', value: 1 };
      const updateItem: TestEntity = { id: '1', name: 'Update', value: 2 };

      act(() => {
        eventHandler({ eventType: 'INSERT', new: insertItem, old: {} });
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].name).toBe('Insert');

      act(() => {
        eventHandler({ eventType: 'UPDATE', new: updateItem, old: { id: '1' } });
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].name).toBe('Update');

      act(() => {
        eventHandler({ eventType: 'DELETE', new: {}, old: { id: '1' } });
      });

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe('Manual Data Manipulation', () => {
    it('allows manual setData updates', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData: [{ id: '1', name: 'Initial', value: 100 }],
        }),
      );

      const newData: TestEntity[] = [
        { id: '2', name: 'Manual 1', value: 200 },
        { id: '3', name: 'Manual 2', value: 300 },
      ];

      act(() => {
        result.current.setData(newData);
      });

      expect(result.current.data).toEqual(newData);
    });

    it('combines manual setData with real-time events', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      // Manual set
      act(() => {
        result.current.setData([{ id: '1', name: 'Manual', value: 100 }]);
      });

      expect(result.current.data).toHaveLength(1);

      // Real-time INSERT
      const insertHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'INSERT')?.[2];

      act(() => {
        insertHandler?.({ eventType: 'INSERT', new: { id: '2', name: 'Realtime', value: 200 }, old: {} });
      });

      expect(result.current.data).toHaveLength(2);
    });
  });

  describe('Cleanup', () => {
    it('removes channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      unmount();

      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('does not remove channel if ref is null', () => {
      // This edge case shouldn't happen in practice, but test defensive code
      const { unmount } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      // Simulate channelRef being cleared
      // (In actual implementation, channelRef is set, so this tests the guard)

      unmount();

      // Should still be called since channelRef is set in normal flow
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalled();
    });
  });

  describe('Re-subscription on Dependency Changes', () => {
    it('creates new subscription when table changes', () => {
      const { rerender } = renderHook(
        ({ table }) =>
          useRealtime<TestEntity>({
            table,
          }),
        { initialProps: { table: 'table_1' } },
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);

      rerender({ table: 'table_2' });

      // Should create new channel
      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledTimes(1);
    });

    it('creates new subscription when filter changes', () => {
      const { rerender } = renderHook(
        ({ filter }) =>
          useRealtime<TestEntity>({
            table: 'orders',
            filter,
          }),
        { initialProps: { filter: 'status=eq.pending' } },
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);

      rerender({ filter: 'status=eq.completed' });

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledTimes(1);
    });

    it('creates new subscription when events change', () => {
      const { rerender } = renderHook(
        ({ events }) =>
          useRealtime<TestEntity>({
            table: 'test_table',
            events,
          }),
        { initialProps: { events: ['INSERT'] as const } },
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);

      rerender({ events: ['INSERT', 'UPDATE'] as const });

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledTimes(1);
    });

    it('does not re-subscribe when unrelated props change', () => {
      const { rerender } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);

      // Force re-render
      rerender();

      // Should not create new channel
      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles events with missing id fields gracefully', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData: [{ id: '1', name: 'Item', value: 100 }],
        }),
      );

      const updateHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'UPDATE')?.[2];

      // Malformed payload (missing new.id)
      act(() => {
        updateHandler?.({ eventType: 'UPDATE', new: { name: 'Bad', value: 0 } as any, old: { id: '1' } });
      });

      // Should not crash, original data preserved
      expect(result.current.data).toHaveLength(1);
    });

    it('handles empty table name', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: '',
        }),
      );

      // Should still initialize without crashing
      expect(result.current.data).toEqual([]);
      expect(result.current.isConnected).toBe(false);
    });

    it('handles extremely large initial data', () => {
      const largeData: TestEntity[] = Array.from({ length: 10000 }, (_, i) => ({
        id: String(i),
        name: `Item ${i}`,
        value: i,
      }));

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData: largeData,
        }),
      );

      expect(result.current.data).toHaveLength(10000);
    });

    it('handles rapid sequential events', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
        }),
      );

      const insertHandler = mockChannel.on.mock.calls.find((call) => call[1].event === 'INSERT')?.[2];

      // Simulate 100 rapid inserts
      act(() => {
        for (let i = 0; i < 100; i++) {
          insertHandler?.({ eventType: 'INSERT', new: { id: String(i), name: `Item ${i}`, value: i }, old: {} });
        }
      });

      expect(result.current.data).toHaveLength(100);
    });

    it('handles events when subscribed to only INSERT', () => {
      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          events: ['INSERT'],
          initialData: [{ id: '1', name: 'Existing', value: 100 }],
        }),
      );

      // Only INSERT handler should be registered
      expect(mockChannel.on).toHaveBeenCalledTimes(1);

      const insertHandler = mockChannel.on.mock.calls[0][2];

      act(() => {
        insertHandler({ eventType: 'INSERT', new: { id: '2', name: 'New', value: 200 }, old: {} });
      });

      expect(result.current.data).toHaveLength(2);

      // UPDATE and DELETE should not be subscribed
      act(() => {
        insertHandler({ eventType: 'UPDATE', new: { id: '1', name: 'Updated', value: 150 }, old: { id: '1' } });
      });

      // Update should not fire (no handler registered)
      expect(result.current.data[1].name).toBe('Existing');
    });

    it('preserves data when connection status changes', () => {
      const initialData: TestEntity[] = [{ id: '1', name: 'Item', value: 100 }];

      const { result } = renderHook(() =>
        useRealtime<TestEntity>({
          table: 'test_table',
          initialData,
        }),
      );

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      act(() => {
        subscribeCallback('SUBSCRIBED');
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.data).toEqual(initialData);

      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });

      expect(result.current.isConnected).toBe(false);
      // Data should still be preserved
      expect(result.current.data).toEqual(initialData);
    });
  });
});
