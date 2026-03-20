import { useState, useEffect, useRef, useCallback } from 'react';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

export interface OrderStatus {
  order_id: string;
  symbol: string;
  side: string;
  status: string;
  fill_price: number | null;
  filled_qty: number;
  submitted_at: string;
}

const TERMINAL_STATUSES = new Set(['filled', 'rejected', 'cancelled']);
const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 30_000;

interface UseOrderPollingOptions {
  orderId: string | null;
  onSettled: (order: OrderStatus) => void;
  onTimeout?: (lastOrder: OrderStatus | null) => void;
}

interface SettledState {
  settledForId: string | null;
}

export function useOrderPolling({ orderId, onSettled, onTimeout }: UseOrderPollingOptions) {
  const [pollingOrder, setPollingOrder] = useState<OrderStatus | null>(null);
  const [settledState, setSettledState] = useState<SettledState>({
    settledForId: null,
  });
  const onSettledRef = useRef(onSettled);
  const onTimeoutRef = useRef(onTimeout);
  const latestOrderRef = useRef<OrderStatus | null>(null);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const poll = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(engineUrl(`/api/v1/portfolio/orders/${id}`), {
        signal: AbortSignal.timeout(5000),
        headers: engineHeaders(),
      });
      if (!res.ok) return false;
      const order: OrderStatus = await res.json();
      setPollingOrder(order);
      latestOrderRef.current = order;
      if (TERMINAL_STATUSES.has(order.status)) {
        onSettledRef.current(order);
        return true;
      }
    } catch {
      // Skip failed polls and retry on the next interval.
    }
    return false;
  }, []);

  useEffect(() => {
    if (!orderId) {
      latestOrderRef.current = null;
      return;
    }

    latestOrderRef.current = null;
    const startTime = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const done = await poll(orderId);
      if (cancelled) return;
      if (done || Date.now() - startTime >= MAX_POLL_TIME) {
        setSettledState({ settledForId: orderId });
        if (!done) onTimeoutRef.current?.(latestOrderRef.current);
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL);
    };

    timer = setTimeout(tick, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPollingOrder(null);
      latestOrderRef.current = null;
    };
  }, [orderId, poll]);

  const isPolling = orderId !== null && settledState.settledForId !== orderId;

  return { pollingOrder, isPolling };
}
