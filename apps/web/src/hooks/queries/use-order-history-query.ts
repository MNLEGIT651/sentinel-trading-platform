'use client';

import { useQuery } from '@tanstack/react-query';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { useAppStore } from '@/stores/app-store';
import { queryKeys } from '@/lib/query-keys';

export interface OrderHistoryEntry {
  order_id: string;
  symbol: string;
  side: string;
  order_type: string;
  qty: number;
  filled_qty: number;
  status: string;
  fill_price: number | null;
  submitted_at: string;
  filled_at: string | null;
  risk_note: string | null;
}

async function fetchOrderHistory(limit: number): Promise<OrderHistoryEntry[]> {
  const res = await fetch(engineUrl(`/api/v1/portfolio/orders/history?limit=${limit}`), {
    signal: AbortSignal.timeout(6000),
    headers: engineHeaders(),
  });
  if (!res.ok) throw new Error(`Order history fetch failed: ${res.status}`);
  return res.json();
}

export function useOrderHistoryQuery(limit = 20) {
  const engineOnline = useAppStore((s) => s.engineOnline);

  return useQuery({
    queryKey: queryKeys.portfolio.orders.history(limit),
    queryFn: () => fetchOrderHistory(limit),
    enabled: engineOnline === true,
  });
}
