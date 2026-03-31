import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import type { TradingPolicy } from '@sentinel/shared';
import { DEFAULT_TRADING_POLICY } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Zod Schemas ────────────────────────────────────────────────────────

const PolicyUpdateSchema = z
  .object({
    max_position_pct: z.number().gt(0).lte(100).optional(),
    max_sector_pct: z.number().gt(0).lte(100).optional(),
    daily_loss_limit_pct: z.number().gt(0).lte(100).optional(),
    soft_drawdown_pct: z.number().gt(0).lte(100).optional(),
    hard_drawdown_pct: z.number().gt(0).lte(100).optional(),
    max_open_positions: z.number().int().min(1).max(1000).optional(),
    paper_trading: z.boolean().optional(),
    auto_trading: z.boolean().optional(),
    require_confirmation: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'No valid fields provided',
  })
  .refine(
    (data) => {
      if (data.soft_drawdown_pct !== undefined && data.hard_drawdown_pct !== undefined) {
        return data.soft_drawdown_pct <= data.hard_drawdown_pct;
      }
      return true;
    },
    { message: 'soft_drawdown_pct must be ≤ hard_drawdown_pct' },
  );

// ─── GET: Fetch user policy (upserts default if none exists) ────────

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    // Try to fetch existing policy
    const { data: existing, error: fetchError } = await supabase
      .from('user_trading_policy')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch policy', details: fetchError.message },
        { status: 500 },
      );
    }

    if (existing) {
      return NextResponse.json(existing as TradingPolicy);
    }

    // No policy yet — create default
    const { data: created, error: insertError } = await supabase
      .from('user_trading_policy')
      .insert({ user_id: user.id, ...DEFAULT_TRADING_POLICY })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create default policy', details: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(created as TradingPolicy);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT: Update user policy ──────────────────────────────────────────

export async function PUT(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, PolicyUpdateSchema);
    if (body instanceof NextResponse) return body;

    // Upsert: insert if not exists, update if exists
    const { data: updated, error: upsertError } = await supabase
      .from('user_trading_policy')
      .upsert({ user_id: user.id, ...body }, { onConflict: 'user_id' })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to update policy', details: upsertError.message },
        { status: 500 },
      );
    }

    // Log the policy change as an operator action for audit trail
    await supabase.from('operator_actions').insert({
      operator_id: user.id,
      action_type: 'update_policy',
      target_type: 'user_trading_policy',
      target_id: user.id,
      metadata: body,
    });

    return NextResponse.json(updated as TradingPolicy);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
