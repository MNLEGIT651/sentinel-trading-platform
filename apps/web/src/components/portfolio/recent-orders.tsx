'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { OrderHistoryEntry } from '@/hooks/use-order-history';

const STATUS_STYLES: Record<string, string> = {
  filled: 'bg-profit/15 text-profit',
  accepted: 'bg-amber-500/15 text-amber-400',
  partially_filled: 'bg-amber-500/15 text-amber-400',
  rejected: 'bg-loss/15 text-loss',
  cancelled: 'bg-loss/15 text-loss',
};

const STATUS_LABELS: Record<string, string> = {
  filled: 'Filled',
  accepted: 'Open',
  partially_filled: 'Partial',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

interface RecentOrdersProps {
  orders: OrderHistoryEntry[];
  pollingOrderId: string | null;
}

export function RecentOrders({ orders, pollingOrderId }: RecentOrdersProps) {
  if (orders.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No recent orders</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Symbol</th>
                <th className="px-3 py-2 text-left font-medium">Side</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Fill Price</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isPolling = order.order_id === pollingOrderId;
                return (
                  <tr
                    key={order.order_id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-mono font-medium text-foreground">
                      {order.symbol}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'font-medium uppercase',
                          order.side === 'buy' ? 'text-profit' : 'text-loss',
                        )}
                      >
                        {order.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{order.qty}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        {isPolling && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium',
                            STATUS_STYLES[order.status] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">
                      {order.fill_price != null ? `$${order.fill_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatTime(order.submitted_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
