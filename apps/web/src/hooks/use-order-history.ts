import { useState, useEffect, useCallback } from 'react';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

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

export function useOrderHistory() {
  const [orders, setOrders] = useState<OrderHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(engineUrl('/api/v1/portfolio/orders/history?limit=20'), {
        signal: AbortSignal.timeout(6000),
        headers: engineHeaders(),
      });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch {
      // Engine offline — keep existing data
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { orders, isLoading, refresh: fetchHistory };
}
