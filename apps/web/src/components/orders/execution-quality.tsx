import { cn } from '@/lib/utils';
import type { OrderHistoryEntry } from '@/hooks/queries/use-order-history-query';
import { formatCurrency } from './helpers';

interface ExecutionQualityProps {
  order: OrderHistoryEntry;
}

export function ExecutionQuality({ order }: ExecutionQualityProps) {
  if (order.fill_price == null || order.status !== 'filled') return null;

  return (
    <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/50 p-2">
      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
        Execution Quality
      </p>
      <div className="flex flex-wrap gap-3 text-xs">
        <div>
          <span className="text-zinc-500">Fill Price: </span>
          <span className="text-zinc-200 font-medium">{formatCurrency(order.fill_price)}</span>
        </div>
        {order.order_type !== 'market' && (
          <div>
            <span className="text-zinc-500">
              {order.order_type === 'limit' ? 'Limit' : 'Request'} Price:{' '}
            </span>
            <span className="text-zinc-200">
              {order.fill_price ? formatCurrency(order.fill_price) : '—'}
            </span>
          </div>
        )}
        <div>
          <span className="text-zinc-500">Fill Rate: </span>
          <span
            className={cn(
              'font-medium',
              order.filled_qty >= order.qty ? 'text-green-400' : 'text-amber-400',
            )}
          >
            {order.qty > 0 ? ((order.filled_qty / order.qty) * 100).toFixed(0) : 0}%
          </span>
          <span className="text-zinc-600 ml-1">
            ({order.filled_qty}/{order.qty})
          </span>
        </div>
      </div>
    </div>
  );
}
