'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { queryKeys } from '@/lib/query-keys';

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

async function fetchOrderStatus(orderId: string): Promise<OrderStatus> {
  const res = await fetch(engineUrl(`/api/v1/portfolio/orders/${orderId}`), {
    signal: AbortSignal.timeout(5000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Order status fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Polls a single order's status every 2 seconds until it reaches a terminal state.
 * Pass `orderId: null` to disable polling.
 */
export function useOrderStatusQuery(
  orderId: string | null,
  opts?: { onSettled?: (order: OrderStatus) => void },
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.portfolio.orders.single(orderId ?? '__none__'),
    queryFn: async () => {
      const order = await fetchOrderStatus(orderId!);
      if (TERMINAL_STATUSES.has(order.status)) {
        // Invalidate portfolio data when order settles
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.account() });
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.positions() });
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.orders.all() });
        opts?.onSettled?.(order);
      }
      return order;
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && TERMINAL_STATUSES.has(data.status)) return false;
      return 2_000;
    },
  });
}
