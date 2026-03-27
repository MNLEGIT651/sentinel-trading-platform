import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/regime — Get current regime + recent history
 * POST /api/regime — Record a new regime classification
 */

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get latest regime
  const { data: latest, error: latestErr } = await supabase
    .from('market_regime_history')
    .select('*')
    .eq('user_id', user.id)
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    return NextResponse.json({ error: latestErr.message }, { status: 500 });
  }

  // Get recent history (last 30 entries)
  const { data: history, error: histErr } = await supabase
    .from('market_regime_history')
    .select('*')
    .eq('user_id', user.id)
    .order('detected_at', { ascending: false })
    .limit(30);

  if (histErr) {
    return NextResponse.json({ error: histErr.message }, { status: 500 });
  }

  // Get active playbook for current regime
  let activePlaybook = null;
  if (latest) {
    const { data: playbook } = await supabase
      .from('regime_playbooks')
      .select('*')
      .eq('user_id', user.id)
      .eq('regime', latest.regime)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    activePlaybook = playbook;
  }

  return NextResponse.json({
    current: latest ?? null,
    active_playbook: activePlaybook,
    history: history ?? [],
  });
}

const VALID_REGIMES = ['bull', 'bear', 'sideways', 'volatile', 'crisis'] as const;
const VALID_SOURCES = ['manual', 'agent', 'algorithm'] as const;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (!body.regime || !VALID_REGIMES.includes(body.regime)) {
    return NextResponse.json(
      { error: `Invalid regime. Must be one of: ${VALID_REGIMES.join(', ')}` },
      { status: 400 },
    );
  }

  if (body.source && !VALID_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` },
      { status: 400 },
    );
  }

  const confidence =
    typeof body.confidence === 'number' ? Math.max(0, Math.min(1, body.confidence)) : 0.5;

  const { data, error } = await supabase
    .from('market_regime_history')
    .insert({
      user_id: user.id,
      regime: body.regime,
      confidence,
      indicators: body.indicators ?? {},
      source: body.source ?? 'manual',
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
