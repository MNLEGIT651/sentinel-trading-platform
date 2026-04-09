import { cn } from '@/lib/utils';
import { sideColors } from '@/lib/status-colors';
import type { OrderHistoryEntry } from '@/hooks/queries/use-order-history-query';
import { formatTimestamp, formatCurrency } from './helpers';
import { OrderLifecycleBar, ORDER_STATUS_STEPS } from './order-lifecycle-bar';
import { ExecutionQuality } from './execution-quality';

interface OrderDetailProps {
  order: OrderHistoryEntry;
}

export function OrderDetail({ order }: OrderDetailProps) {
  return (
    <div className="space-y-2">
      {/* Lifecycle bar */}
      <div>
        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          Order Lifecycle
        </p>
        <OrderLifecycleBar status={order.status} />
        <div className="flex gap-2 sm:gap-3 mt-1 text-[10px] text-zinc-600">
          {ORDER_STATUS_STEPS.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3 sm:gap-x-6">
        <div>
          <span className="text-zinc-500">Order ID</span>
          <p className="text-zinc-300 font-mono text-[11px] truncate">{order.order_id}</p>
        </div>
        <div>
          <span className="text-zinc-500">Symbol</span>
          <p className="text-zinc-300 font-semibold">{order.symbol}</p>
        </div>
        <div>
          <span className="text-zinc-500">Side</span>
          <p
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              sideColors[order.side] ?? 'text-zinc-400',
            )}
          >
            {order.side.toUpperCase()}
          </p>
        </div>
        <div>
          <span className="text-zinc-500">Type</span>
          <p className="text-zinc-300">{order.order_type}</p>
        </div>
        <div>
          <span className="text-zinc-500">Quantity</span>
          <p className="text-zinc-300">{order.qty}</p>
        </div>
        <div>
          <span className="text-zinc-500">Filled Qty</span>
          <p className="text-zinc-300">{order.filled_qty}</p>
        </div>
        {order.fill_price != null && (
          <div>
            <span className="text-zinc-500">Fill Price</span>
            <p className="text-zinc-300">{formatCurrency(order.fill_price)}</p>
          </div>
        )}
        {order.submitted_at && (
          <div>
            <span className="text-zinc-500">Submitted</span>
            <p className="text-zinc-300">{formatTimestamp(order.submitted_at)}</p>
          </div>
        )}
        {order.filled_at && (
          <div>
            <span className="text-zinc-500">Filled</span>
            <p className="text-zinc-300">{formatTimestamp(order.filled_at)}</p>
          </div>
        )}
      </div>

      {order.risk_note && (
        <div className="text-xs">
          <span className="text-zinc-500">Risk Note: </span>
          <span className="text-zinc-300">{order.risk_note}</span>
        </div>
      )}

      <ExecutionQuality order={order} />
    </div>
  );
}
