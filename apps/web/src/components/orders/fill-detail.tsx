import type { Fill } from '@sentinel/shared';
import { formatCurrency } from './helpers';

interface FillDetailProps {
  fill: Fill;
}

export function FillDetail({ fill }: FillDetailProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3 sm:gap-x-6">
        <div>
          <span className="text-zinc-500">Order ID</span>
          <p className="text-zinc-300 font-mono text-[11px] truncate">{fill.order_id}</p>
        </div>
        <div>
          <span className="text-zinc-500">Fill Price</span>
          <p className="text-zinc-300">{formatCurrency(fill.fill_price)}</p>
        </div>
        <div>
          <span className="text-zinc-500">Fill Qty</span>
          <p className="text-zinc-300">{fill.fill_qty}</p>
        </div>
        <div>
          <span className="text-zinc-500">Commission</span>
          <p className="text-zinc-300">
            {fill.commission != null ? formatCurrency(fill.commission) : '—'}
          </p>
        </div>
        <div>
          <span className="text-zinc-500">Slippage</span>
          <p className="text-zinc-300">{fill.slippage != null ? fill.slippage.toFixed(4) : '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">Venue</span>
          <p className="text-zinc-300">{(fill as Fill & { venue?: string | null }).venue ?? '—'}</p>
        </div>
      </div>
      {(fill as Fill & { broker_fill_id?: string | null }).broker_fill_id && (
        <div className="text-xs">
          <span className="text-zinc-500">Broker Fill ID: </span>
          <span className="text-zinc-400 font-mono">
            {(fill as Fill & { broker_fill_id?: string | null }).broker_fill_id}
          </span>
        </div>
      )}
    </div>
  );
}
