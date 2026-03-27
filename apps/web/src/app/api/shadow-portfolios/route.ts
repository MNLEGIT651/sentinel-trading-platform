import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STRATEGIES = [
  'rsi_momentum',
  'roc_momentum',
  'obv_divergence',
  'sma_crossover',
  'ema_momentum_trend',
  'macd_trend',
  'bollinger_reversion',
  'zscore_reversion',
  'rsi_mean_reversion',
  'price_to_ma_value',
  'relative_value',
  'pairs_spread',
];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('shadow_portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shadow_portfolios: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Validate strategies if provided
  if (body.enabled_strategies) {
    const invalid = (body.enabled_strategies as string[]).filter(
      (s) => !VALID_STRATEGIES.includes(s),
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid strategies: ${invalid.join(', ')}` },
        { status: 400 },
      );
    }
  }

  const insert = {
    user_id: user.id,
    name: body.name.trim(),
    description: body.description ?? null,
    max_position_pct: body.max_position_pct ?? null,
    max_sector_pct: body.max_sector_pct ?? null,
    daily_loss_limit_pct: body.daily_loss_limit_pct ?? null,
    soft_drawdown_pct: body.soft_drawdown_pct ?? null,
    hard_drawdown_pct: body.hard_drawdown_pct ?? null,
    max_open_positions: body.max_open_positions ?? null,
    enabled_strategies: body.enabled_strategies ?? [],
    disabled_strategies: body.disabled_strategies ?? [],
    initial_capital: body.initial_capital ?? 100000,
  };

  const { data, error } = await supabase.from('shadow_portfolios').insert(insert).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
