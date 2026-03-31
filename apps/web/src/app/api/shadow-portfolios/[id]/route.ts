import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const patchBodySchema = z
  .object({
    name: z.string().optional(),
    description: z.string().nullish(),
    max_position_pct: z.number().nullish(),
    max_sector_pct: z.number().nullish(),
    daily_loss_limit_pct: z.number().nullish(),
    soft_drawdown_pct: z.number().nullish(),
    hard_drawdown_pct: z.number().nullish(),
    max_open_positions: z.number().int().nullish(),
    enabled_strategies: z.array(z.string()).optional(),
    disabled_strategies: z.array(z.string()).optional(),
    initial_capital: z.number().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'No fields to update',
  });

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  // Fetch shadow portfolio
  const { data: portfolio, error: portErr } = await supabase
    .from('shadow_portfolios')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (portErr || !portfolio) {
    return NextResponse.json({ error: 'Shadow portfolio not found' }, { status: 404 });
  }

  // Fetch latest snapshots for comparison chart
  const { data: snapshots } = await supabase
    .from('shadow_portfolio_snapshots')
    .select('*')
    .eq('shadow_portfolio_id', id)
    .order('snapshot_at', { ascending: false })
    .limit(90);

  return NextResponse.json({
    portfolio,
    snapshots: snapshots ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(req, patchBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const updates: Record<string, unknown> = {};
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.max_position_pct !== undefined) updates.max_position_pct = parsed.max_position_pct;
  if (parsed.max_sector_pct !== undefined) updates.max_sector_pct = parsed.max_sector_pct;
  if (parsed.daily_loss_limit_pct !== undefined)
    updates.daily_loss_limit_pct = parsed.daily_loss_limit_pct;
  if (parsed.soft_drawdown_pct !== undefined) updates.soft_drawdown_pct = parsed.soft_drawdown_pct;
  if (parsed.hard_drawdown_pct !== undefined) updates.hard_drawdown_pct = parsed.hard_drawdown_pct;
  if (parsed.max_open_positions !== undefined)
    updates.max_open_positions = parsed.max_open_positions;
  if (parsed.enabled_strategies !== undefined)
    updates.enabled_strategies = parsed.enabled_strategies;
  if (parsed.disabled_strategies !== undefined)
    updates.disabled_strategies = parsed.disabled_strategies;
  if (parsed.initial_capital !== undefined) updates.initial_capital = parsed.initial_capital;
  if (parsed.is_active !== undefined) updates.is_active = parsed.is_active;

  const { data, error } = await supabase
    .from('shadow_portfolios')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to update portfolio') },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const { error } = await supabase
    .from('shadow_portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to delete portfolio') },
      { status: 500 },
    );
  }

  return NextResponse.json({ deleted: true });
}
