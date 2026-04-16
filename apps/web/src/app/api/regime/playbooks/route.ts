import { NextResponse } from 'next/server';
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
] as const;

const VALID_REGIMES = ['bull', 'bear', 'sideways', 'volatile', 'crisis'] as const;

const postBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .transform((s) => s.trim()),
  regime: z.enum(VALID_REGIMES),
  description: z.string().nullish(),
  enabled_strategies: z
    .array(z.enum(VALID_STRATEGIES as unknown as [string, ...string[]]))
    .optional()
    .default([]),
  disabled_strategies: z
    .array(z.enum(VALID_STRATEGIES as unknown as [string, ...string[]]))
    .optional()
    .default([]),
  strategy_weights: z
    .record(z.enum(VALID_STRATEGIES as unknown as [string, ...string[]]), z.number())
    .optional()
    .default({}),
  max_position_pct: z.number().nullish(),
  max_sector_pct: z.number().nullish(),
  daily_loss_limit_pct: z.number().nullish(),
  position_size_modifier: z.number().optional().default(1.0),
  auto_approve: z.boolean().optional().default(false),
  require_confirmation: z.boolean().optional().default(true),
});

/**
 * GET /api/regime/playbooks ΓÇö List all playbooks
 * POST /api/regime/playbooks ΓÇö Create a playbook
 */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { data, error } = await supabase
    .from('regime_playbooks')
    .select('*')
    .eq('user_id', user.id)
    .order('regime', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch playbooks') },
      { status: 500 },
    );
  }

  return NextResponse.json({ playbooks: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { data, error } = await supabase
    .from('regime_playbooks')
    .insert({
      user_id: user.id,
      name: parsed.name,
      regime: parsed.regime,
      description: parsed.description ?? null,
      enabled_strategies: parsed.enabled_strategies,
      disabled_strategies: parsed.disabled_strategies,
      strategy_weights: parsed.strategy_weights,
      max_position_pct: parsed.max_position_pct ?? null,
      max_sector_pct: parsed.max_sector_pct ?? null,
      daily_loss_limit_pct: parsed.daily_loss_limit_pct ?? null,
      position_size_modifier: parsed.position_size_modifier,
      auto_approve: parsed.auto_approve,
      require_confirmation: parsed.require_confirmation,
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
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to create playbook') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
