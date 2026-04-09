'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { queryKeys } from '@/lib/query-keys';
import { OrderSubmitError } from '@/lib/order-errors';

interface SubmitOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type?: 'market' | 'limit';
  time_in_force?: 'day' | 'gtc' | 'ioc' | 'fok';
  limit_price?: number;
}

interface SubmitOrderResult {
  order_id: string;
  status: string;
}

async function submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResult> {
  const res = await fetch(engineUrl('/api/v1/portfolio/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...engineHeaders() },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new OrderSubmitError(body.error || `Order submit failed: ${res.status}`, {
      status: res.status,
      reason: body.reason,
      code: body.code,
      retryable: body.retryable,
    });
  }
  return res.json();
}

export function useSubmitOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.account() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.positions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.orders.all() });
    },
  });
}
