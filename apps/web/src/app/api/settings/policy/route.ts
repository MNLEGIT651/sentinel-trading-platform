import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { TradingPolicy, TradingPolicyUpdate } from '@sentinel/shared';
import { DEFAULT_TRADING_POLICY } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Validation ─────────────────────────────────────────────────────

const NUMERIC_FIELDS = [
  'max_position_pct',
  'max_sector_pct',
  'daily_loss_limit_pct',
  'soft_drawdown_pct',
  'hard_drawdown_pct',
] as const;

const BOOLEAN_FIELDS = ['paper_trading', 'auto_trading', 'require_confirmation'] as const;

function validatePolicyUpdate(body: unknown):
  | {
      valid: true;
      data: TradingPolicyUpdate;
    }
  | {
      valid: false;
      error: string;
    } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const update: TradingPolicyUpdate = {};
  const raw = body as Record<string, unknown>;

  for (const field of NUMERIC_FIELDS) {
    if (field in raw) {
      const val = Number(raw[field]);
      if (isNaN(val) || val <= 0 || val > 100) {
        return { valid: false, error: `${field} must be a number between 0 and 100` };
      }
      (update as Record<string, number>)[field] = val;
    }
  }

  if ('max_open_positions' in raw) {
    const val = Number(raw.max_open_positions);
    if (isNaN(val) || val < 1 || val > 1000 || !Number.isInteger(val)) {
      return { valid: false, error: 'max_open_positions must be an integer between 1 and 1000' };
    }
    update.max_open_positions = val;
  }

  for (const field of BOOLEAN_FIELDS) {
    if (field in raw) {
      if (typeof raw[field] !== 'boolean') {
        return { valid: false, error: `${field} must be a boolean` };
      }
      (update as Record<string, boolean>)[field] = raw[field] as boolean;
    }
  }

  // Cross-field validation: soft drawdown must be ≤ hard drawdown
  const soft = update.soft_drawdown_pct;
  const hard = update.hard_drawdown_pct;
  if (soft !== undefined && hard !== undefined && soft > hard) {
    return { valid: false, error: 'soft_drawdown_pct must be ≤ hard_drawdown_pct' };
  }

  if (Object.keys(update).length === 0) {
    return { valid: false, error: 'No valid fields provided' };
  }

  return { valid: true, data: update };
}

// ─── GET: Fetch user policy (upserts default if none exists) ────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

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

// ─── PUT: Update user policy ────────────────────────────────────────

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validation = validatePolicyUpdate(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Upsert: insert if not exists, update if exists
    const { data: updated, error: upsertError } = await supabase
      .from('user_trading_policy')
      .upsert({ user_id: user.id, ...validation.data }, { onConflict: 'user_id' })
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
      metadata: validation.data,
    });

    return NextResponse.json(updated as TradingPolicy);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
