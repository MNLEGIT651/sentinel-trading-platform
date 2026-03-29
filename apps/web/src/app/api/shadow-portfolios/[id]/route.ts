import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.max_position_pct !== undefined) updates.max_position_pct = body.max_position_pct;
  if (body.max_sector_pct !== undefined) updates.max_sector_pct = body.max_sector_pct;
  if (body.daily_loss_limit_pct !== undefined)
    updates.daily_loss_limit_pct = body.daily_loss_limit_pct;
  if (body.soft_drawdown_pct !== undefined) updates.soft_drawdown_pct = body.soft_drawdown_pct;
  if (body.hard_drawdown_pct !== undefined) updates.hard_drawdown_pct = body.hard_drawdown_pct;
  if (body.max_open_positions !== undefined) updates.max_open_positions = body.max_open_positions;
  if (body.enabled_strategies !== undefined) updates.enabled_strategies = body.enabled_strategies;
  if (body.disabled_strategies !== undefined)
    updates.disabled_strategies = body.disabled_strategies;
  if (body.initial_capital !== undefined) updates.initial_capital = body.initial_capital;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
