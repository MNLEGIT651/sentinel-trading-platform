import { NextResponse } from 'next/server';
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
] as const;

const VALID_REGIMES = ['bull', 'bear', 'sideways', 'volatile', 'crisis'] as const;

/**
 * GET /api/regime/playbooks — List all playbooks
 * POST /api/regime/playbooks — Create a playbook
 */

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('regime_playbooks')
    .select('*')
    .eq('user_id', user.id)
    .order('regime', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  if (!body.regime || !VALID_REGIMES.includes(body.regime)) {
    return NextResponse.json(
      { error: `Invalid regime. Must be one of: ${VALID_REGIMES.join(', ')}` },
      { status: 400 },
    );
  }

  // Validate strategies
  const enabled = body.enabled_strategies ?? [];
  const disabled = body.disabled_strategies ?? [];
  for (const s of [...enabled, ...disabled]) {
    if (!VALID_STRATEGIES.includes(s)) {
      return NextResponse.json({ error: `Invalid strategy: ${s}` }, { status: 400 });
    }
  }

  // Validate strategy_weights keys
  const weights = body.strategy_weights ?? {};
  for (const key of Object.keys(weights)) {
    if (!VALID_STRATEGIES.includes(key as (typeof VALID_STRATEGIES)[number])) {
      return NextResponse.json({ error: `Invalid strategy in weights: ${key}` }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('regime_playbooks')
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      regime: body.regime,
      description: body.description ?? null,
      enabled_strategies: enabled,
      disabled_strategies: disabled,
      strategy_weights: weights,
      max_position_pct: body.max_position_pct ?? null,
      max_sector_pct: body.max_sector_pct ?? null,
      daily_loss_limit_pct: body.daily_loss_limit_pct ?? null,
      position_size_modifier: body.position_size_modifier ?? 1.0,
      auto_approve: body.auto_approve ?? false,
      require_confirmation: body.require_confirmation ?? true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A playbook with this name already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
