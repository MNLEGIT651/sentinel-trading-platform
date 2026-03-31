import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SystemControls } from '@sentinel/shared';
import { safeErrorMessage } from '@/lib/api-error';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/system-controls ΓÇö fetch the single system controls row
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const { data, error } = await supabase.from('system_controls').select('*').limit(1).single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch controls') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data as SystemControls });
}

// PATCH /api/system-controls ΓÇö update system controls (operator role required)
export async function PATCH(request: Request) {
  const auth = await requireRole('operator');
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = checkApiRateLimit(user.id);
  if (rl) return rl;

  const SystemControlsUpdateSchema = z.object({
    trading_halted: z.boolean().optional(),
    live_execution_enabled: z.boolean().optional(),
    global_mode: z.enum(['paper', 'live', 'backtest'] as const).optional(),
    max_daily_trades: z
      .number()
      .int()
      .min(1, 'max_daily_trades must be a positive integer')
      .optional(),
  });

  const body = await parseBody(request, SystemControlsUpdateSchema);
  if (body instanceof NextResponse) return body;

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
