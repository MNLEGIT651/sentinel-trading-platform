import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

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

const postBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .transform((s) => s.trim()),
  description: z.string().nullish(),
  max_position_pct: z.number().nullish(),
  max_sector_pct: z.number().nullish(),
  daily_loss_limit_pct: z.number().nullish(),
  soft_drawdown_pct: z.number().nullish(),
  hard_drawdown_pct: z.number().nullish(),
  max_open_positions: z.number().int().nullish(),
  enabled_strategies: z
    .array(z.enum(VALID_STRATEGIES as unknown as [string, ...string[]]))
    .optional()
    .default([]),
  disabled_strategies: z.array(z.string()).optional().default([]),
  initial_capital: z.number().optional().default(100000),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { data, error } = await supabase
    .from('shadow_portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch portfolios') },
      { status: 500 },
    );
  }

  return NextResponse.json({ shadow_portfolios: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(req, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const insert = {
    user_id: user.id,
    name: parsed.name,
    description: parsed.description ?? null,
    max_position_pct: parsed.max_position_pct ?? null,
    max_sector_pct: parsed.max_sector_pct ?? null,
    daily_loss_limit_pct: parsed.daily_loss_limit_pct ?? null,
    soft_drawdown_pct: parsed.soft_drawdown_pct ?? null,
    hard_drawdown_pct: parsed.hard_drawdown_pct ?? null,
    max_open_positions: parsed.max_open_positions ?? null,
    enabled_strategies: parsed.enabled_strategies,
    disabled_strategies: parsed.disabled_strategies,
    initial_capital: parsed.initial_capital,
  };

  const { data, error } = await supabase.from('shadow_portfolios').insert(insert).select().single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create portfolio') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
