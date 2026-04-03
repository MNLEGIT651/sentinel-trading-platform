'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { orderStatusColors, DEFAULT_ORDER_STYLE, sideColors } from '@/lib/status-colors';
import type { OrderHistoryEntry } from '@/hooks/use-order-history';

const STATUS_LABELS: Record<string, string> = {
  filled: 'Filled',
  accepted: 'Open',
  partially_filled: 'Partial',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
  pending_new: 'Pending',
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
        <Table aria-label="Recent orders" className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3 py-2 text-left font-medium">Symbol</TableHead>
              <TableHead className="px-3 py-2 text-left font-medium">Side</TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">Qty</TableHead>
              <TableHead className="px-3 py-2 text-left font-medium">Status</TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">Fill Price</TableHead>
              <TableHead className="px-3 py-2 text-right font-medium">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const isPolling = order.order_id === pollingOrderId;
              const statusStyle = orderStatusColors[order.status] ?? DEFAULT_ORDER_STYLE;
              const sideStyle = sideColors[order.side] ?? '';
              return (
                <TableRow key={order.order_id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-2 font-mono font-medium text-foreground">
                    {order.symbol}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                        sideStyle,
                      )}
                    >
                      {order.side}
                    </span>
                  </TableCell>
                  <TableCell numeric className="px-3 py-2 text-right font-mono text-foreground">
                    {order.qty}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      {isPolling && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"
                          aria-label="Polling order status"
                        />
                      )}
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          statusStyle.bg,
                          statusStyle.text,
                        )}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell numeric className="px-3 py-2 text-right font-mono text-foreground">
                    {order.fill_price != null ? `$${order.fill_price.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-muted-foreground">
                    {formatTime(order.submitted_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
