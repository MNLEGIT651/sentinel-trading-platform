import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { dbError, badRequest, notFound } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/advisor/preferences/[id]/dismiss
 * Dismiss a pending preference ΓåÆ sets status to 'dismissed'.
 * Logs a `preference_dismissed` memory event.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    // Fetch current
    const { data: current } = await supabase
      .from('advisor_preferences')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!current) {
      return notFound('Preference not found');
    }

    if (current.status !== 'pending_confirmation') {
      return badRequest('Only pending preferences can be dismissed');
    }

    const { data: updated, error: updateErr } = await supabase
      .from('advisor_preferences')
      .update({ status: 'dismissed' })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateErr) {
      return dbError(updateErr, 'Failed to dismiss preference');
    }

    // Log memory event
    await supabase.from('advisor_memory_events').insert({
      user_id: user.id,
      preference_id: id,
      event_type: 'preference_dismissed',
      previous_value: current,
      new_value: updated,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('preferences/[id]/dismiss.POST', err);
    return dbError({ message: String(err) }, 'Failed to dismiss preference');
  }
}
