import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { apiError, dbError, badRequest, notFound, safeParseBody } from '@/lib/api-error';
import type { ExplanationPayload } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/recommendations/[id]/explanation
 * Get the latest explanation for a recommendation.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: recommendationId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const { data, error } = await supabase
      .from('recommendation_explanations')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', user.id)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return notFound('Explanation not found');
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('explanation.GET', err);
    return dbError({ message: String(err) }, 'Failed to fetch explanation');
  }
}

/**
 * POST /api/recommendations/[id]/explanation
 * Create or update an explanation. Auto-increments version.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: recommendationId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const body = await safeParseBody<{ summary?: string; explanation?: ExplanationPayload }>(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Invalid JSON body');
    }
    const summary = body.summary;
    const explanation = body.explanation;

    if (!summary || !explanation) {
      return badRequest('summary and explanation are required');
    }

    // Atomic version increment with retry on conflict
    let attempts = 0;
    while (attempts < 3) {
      const { data: existing } = await supabase
        .from('recommendation_explanations')
        .select('version')
        .eq('recommendation_id', recommendationId)
        .eq('user_id', user.id)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = (existing?.version ?? 0) + 1;

      const { data, error: insertErr } = await supabase
        .from('recommendation_explanations')
        .insert({
          recommendation_id: recommendationId,
          user_id: user.id,
          summary,
          explanation,
          version: nextVersion,
          generated_at: explanation.generated_at ?? new Date().toISOString(),
        })
        .select()
        .single();

      if (!insertErr) {
        return NextResponse.json(data, { status: 201 });
      }

      // Unique constraint violation = retry with next version
      if (insertErr.code === '23505') {
        attempts++;
        continue;
      }

      return dbError(insertErr, 'Failed to save explanation');
    }

    return apiError(409, 'conflict', 'Could not save explanation after retries');
  } catch (err) {
    console.error('explanation.POST', err);
    return dbError({ message: String(err) }, 'Failed to save explanation');
  }
}
