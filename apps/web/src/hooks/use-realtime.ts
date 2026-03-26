'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface UseRealtimeOptions<T> {
  table: string;
  schema?: string;
  events?: PostgresChangeEvent[];
  filter?: string;
  initialData?: T[];
}

export function useRealtime<T extends { id: string }>({
  table,
  schema = 'public',
  events = ['INSERT', 'UPDATE', 'DELETE'],
  filter,
  initialData = [],
}: UseRealtimeOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleInsert = useCallback((payload: { new: T }) => {
    setData((prev) => [payload.new, ...prev]);
  }, []);

  const handleUpdate = useCallback((payload: { new: T }) => {
    setData((prev) => prev.map((item) => (item.id === payload.new.id ? payload.new : item)));
  }, []);

  const handleDelete = useCallback((payload: { old: { id: string } }) => {
    setData((prev) => prev.filter((item) => item.id !== payload.old.id));
  }, []);

  // Serialize events for stable dependency comparison (arrays are compared by reference)
  const eventsKey = events.join(',');

  useEffect(() => {
    const supabase = createClient();
    const channelName = `realtime-${table}-${Date.now()}`;

    let channel = supabase.channel(channelName);

    for (const event of events) {
      const opts: Record<string, string> = {
        event,
        schema,
        table,
      };
      if (filter) {
        opts.filter = filter;
      }

      channel = channel.on(
        'postgres_changes' as never,
        opts,
        (payload: { eventType: string; new: T; old: { id: string } }) => {
          if (payload.eventType !== event) return;
          if (event === 'INSERT') handleInsert({ new: payload.new });
          if (event === 'UPDATE') handleUpdate({ new: payload.new });
          if (event === 'DELETE') handleDelete({ old: payload.old });
        },
      );
    }

    channel.subscribe((status: string) => {
      setIsConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, schema, filter, eventsKey]);

  return { data, setData, isConnected };
}
