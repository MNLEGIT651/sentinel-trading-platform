import { NextResponse } from 'next/server';
import type { SystemControls, SystemControlsUpdate, SystemMode } from '@sentinel/shared';
import { safeErrorMessage } from '@/lib/api-error';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_MODES: SystemMode[] = ['paper', 'live', 'backtest'];

// GET /api/system-controls — fetch the single system controls row
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const { data, error } = await supabase.from('system_controls').select('*').limit(1).single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch controls') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data as SystemControls });
}

// PATCH /api/system-controls — update system controls (operator role required)
export async function PATCH(request: Request) {
  const auth = await requireRole('operator');
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const body = rawBody as SystemControlsUpdate;

  // Validate fields when present
  if ('trading_halted' in body && typeof body.trading_halted !== 'boolean') {
    return NextResponse.json({ error: 'trading_halted must be a boolean' }, { status: 400 });
  }

  if ('live_execution_enabled' in body && typeof body.live_execution_enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'live_execution_enabled must be a boolean' },
      { status: 400 },
    );
  }

  if ('global_mode' in body && !VALID_MODES.includes(body.global_mode as SystemMode)) {
    return NextResponse.json(
      { error: `global_mode must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 },
    );
  }

  if ('max_daily_trades' in body) {
    const val = body.max_daily_trades;
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
      return NextResponse.json(
        { error: 'max_daily_trades must be a positive integer' },
        { status: 400 },
      );
    }
  }

  // Get the single row's id
  const { data: current, error: fetchError } = await supabase
    .from('system_controls')
    .select('id')
    .limit(1)
    .single();

  if (fetchError || !current) {
    return NextResponse.json(
      { error: fetchError?.message ?? 'System controls row not found' },
      { status: 500 },
    );
  }

  // Update
  const { data: updated, error: updateError } = await supabase
    .from('system_controls')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', current.id)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Derive specific action type from the update payload
  let actionType: string = 'system_config_change';
  if ('trading_halted' in body) {
    actionType = body.trading_halted ? 'halt_trading' : 'resume_trading';
  } else if ('global_mode' in body) {
    actionType = 'change_mode';
  }

  // Log the operator action with a specific action type
  await supabase.from('operator_actions').insert({
    operator_id: user.id,
    action_type: actionType,
    target_type: 'system_controls',
    target_id: current.id,
    metadata: body,
  });

  return NextResponse.json({ data: updated as SystemControls });
}
