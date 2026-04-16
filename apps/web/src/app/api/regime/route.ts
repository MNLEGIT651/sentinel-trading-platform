import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/regime ΓÇö Get current regime + recent history
 * POST /api/regime ΓÇö Record a new regime classification
 */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

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

const postBodySchema = z.object({
  regime: z.enum(VALID_REGIMES),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  indicators: z.record(z.string(), z.unknown()).optional().default({}),
  source: z.enum(VALID_SOURCES).optional().default('manual'),
  notes: z.string().nullish(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, postBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const { data, error } = await supabase
    .from('market_regime_history')
    .insert({
      user_id: user.id,
      regime: parsed.regime,
      confidence: parsed.confidence,
      indicators: parsed.indicators,
      source: parsed.source,
      notes: parsed.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to record regime') },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
