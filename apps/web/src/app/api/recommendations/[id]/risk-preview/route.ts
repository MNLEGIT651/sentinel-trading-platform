import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Position {
  symbol: string;
  qty: number;
  market_value: number;
  current_price: number;
  avg_entry_price: number;
  unrealized_pl: number;
  side: string;
}

interface AccountInfo {
  equity: number;
  cash: number;
  buying_power: number;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch recommendation from agent_recommendations table
  const { data: rec, error: recErr } = await supabase
    .from('agent_recommendations')
    .select('*')
    .eq('id', id)
    .single();

  if (recErr || !rec) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  // Fetch user's trading policy
  const { data: policy } = await supabase
    .from('user_trading_policy')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Use defaults if no policy set
  const limits = {
    max_position_pct: policy?.max_position_pct ?? 5,
    max_sector_pct: policy?.max_sector_pct ?? 20,
    max_open_positions: policy?.max_open_positions ?? 20,
    daily_loss_limit_pct: policy?.daily_loss_limit_pct ?? 2,
    soft_drawdown_pct: policy?.soft_drawdown_pct ?? 10,
    hard_drawdown_pct: policy?.hard_drawdown_pct ?? 15,
  };

  // Try to fetch portfolio data from engine
  let account: AccountInfo | null = null;
  let positions: Position[] = [];

  try {
    const [acctRes, posRes] = await Promise.all([
      fetch(`${engineUrl()}/api/v1/portfolio/account`, { headers: engineHeaders() }),
      fetch(`${engineUrl()}/api/v1/portfolio/positions`, { headers: engineHeaders() }),
    ]);

    if (acctRes.ok) {
      account = await acctRes.json();
    }
    if (posRes.ok) {
      const posData = await posRes.json();
      positions = Array.isArray(posData) ? posData : (posData.positions ?? []);
    }
  } catch {
    // Engine unavailable — compute with fallback values
  }

  const equity = account?.equity ?? 100_000;
  const tradeValue = rec.quantity * (rec.limit_price ?? 0);
  const estimatedTradeValue = tradeValue > 0 ? tradeValue : rec.quantity * 100;

  // Compute policy impacts
  const impacts = [];

  // 1. Position size as % of portfolio
  const existingPosition = positions.find(
    (p: Position) => p.symbol?.toUpperCase() === rec.ticker?.toUpperCase(),
  );
  const currentPositionValue = existingPosition ? Math.abs(existingPosition.market_value) : 0;
  const projectedPositionValue =
    rec.side === 'buy'
      ? currentPositionValue + estimatedTradeValue
      : Math.max(0, currentPositionValue - estimatedTradeValue);
  const currentPositionPct = equity > 0 ? (currentPositionValue / equity) * 100 : 0;
  const projectedPositionPct = equity > 0 ? (projectedPositionValue / equity) * 100 : 0;

  impacts.push({
    metric: 'Position Size',
    current: Math.round(currentPositionPct * 100) / 100,
    projected: Math.round(projectedPositionPct * 100) / 100,
    limit: limits.max_position_pct,
    unit: '%',
  });

  // 2. Open positions count
  const currentCount = positions.length;
  const isNewPosition = !existingPosition;
  const projectedCount = isNewPosition ? currentCount + 1 : currentCount;

  impacts.push({
    metric: 'Open Positions',
    current: currentCount,
    projected: projectedCount,
    limit: limits.max_open_positions,
    unit: '',
  });

  // 3. Portfolio concentration
  const totalPositionsValue = positions.reduce(
    (sum: number, p: Position) => sum + Math.abs(p.market_value ?? 0),
    0,
  );
  const currentConcentration = equity > 0 ? (totalPositionsValue / equity) * 100 : 0;
  const projectedConcentration =
    equity > 0
      ? ((totalPositionsValue + (rec.side === 'buy' ? estimatedTradeValue : -estimatedTradeValue)) /
          equity) *
        100
      : 0;

  impacts.push({
    metric: 'Portfolio Invested',
    current: Math.round(currentConcentration * 100) / 100,
    projected: Math.round(Math.max(0, projectedConcentration) * 100) / 100,
    limit: 100,
    unit: '%',
  });

  // 4. Cash utilization
  const cash = account?.cash ?? equity;
  const currentCashPct = equity > 0 ? (cash / equity) * 100 : 100;
  const projectedCash =
    rec.side === 'buy' ? cash - estimatedTradeValue : cash + estimatedTradeValue;
  const projectedCashPct = equity > 0 ? (projectedCash / equity) * 100 : 100;

  impacts.push({
    metric: 'Cash Available',
    current: Math.round(currentCashPct * 100) / 100,
    projected: Math.round(Math.max(0, projectedCashPct) * 100) / 100,
    limit: 100,
    unit: '%',
  });

  return NextResponse.json({
    recommendation: {
      id: rec.id,
      ticker: rec.ticker,
      side: rec.side,
      quantity: rec.quantity,
      order_type: rec.order_type,
      limit_price: rec.limit_price,
      strategy_name: rec.strategy_name,
      signal_strength: rec.signal_strength,
      reason: rec.reason,
    },
    impacts,
    limits,
    portfolio: {
      equity,
      cash: account?.cash ?? null,
      positions_count: positions.length,
      engine_connected: account !== null,
    },
  });
}
