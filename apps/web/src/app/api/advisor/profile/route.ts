import { NextResponse } from 'next/server';
import type { AdvisorProfilePatch } from '@sentinel/shared';
import { dbError, badRequest, safeParseBody } from '@/lib/api-error';
import { requireAuth } from '@/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/profile
 * Returns the user's advisor profile, creating a default if none exists.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    // Upsert: return existing or create default
    const { data: existing } = await supabase
      .from('advisor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(existing);
    }

    const { data: created, error: insertErr } = await supabase
      .from('advisor_profiles')
      .insert({ user_id: user.id, profile: {} })
      .select()
      .single();

    if (insertErr) {
      return dbError(insertErr, 'Failed to create advisor profile');
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('advisor/profile.GET', err);
    return dbError({ message: String(err) }, 'Failed to load advisor profile');
  }
}

/**
 * PATCH /api/advisor/profile
 * Merge-patches the profile JSONB and increments version.
 * Logs a `profile_updated` memory event.
 */
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const patch = await safeParseBody<AdvisorProfilePatch>(req);
  if (!patch || typeof patch !== 'object') {
    return badRequest('Invalid JSON body');
  }

  try {
    // Fetch current profile
    const { data: current } = await supabase
      .from('advisor_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const previousProfile = current?.profile ?? {};
    const mergedProfile = { ...previousProfile, ...patch };
    const newVersion = (current?.version ?? 0) + 1;

    // Upsert profile
    const { data: updated, error: updateErr } = current
      ? await supabase
          .from('advisor_profiles')
          .update({ profile: mergedProfile, version: newVersion })
          .eq('user_id', user.id)
          .select()
          .single()
      : await supabase
          .from('advisor_profiles')
          .insert({ user_id: user.id, profile: mergedProfile, version: 1 })
          .select()
          .single();

    if (updateErr) {
      return dbError(updateErr, 'Failed to update advisor profile');
    }

    // Log memory event (best-effort, don't fail the request)
    await supabase.from('advisor_memory_events').insert({
      user_id: user.id,
      event_type: 'profile_updated',
      previous_value: previousProfile,
      new_value: mergedProfile,
      metadata: { version: newVersion, fields_changed: Object.keys(patch) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('advisor/profile.PATCH', err);
    return dbError({ message: String(err) }, 'Failed to update advisor profile');
  }
}
