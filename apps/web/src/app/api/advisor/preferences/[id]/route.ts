import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';
import { dbError, notFound } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/advisor/preferences/[id]
 * Edit a preference's content, context, category, or confidence.
 * Logs a `preference_edited` memory event.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const PreferenceUpdateSchema = z
      .object({
        category: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        context: z.string().nullish(),
        confidence: z.number().min(0).max(1).optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: 'No fields to update',
      });

    const body = await parseBody(req, PreferenceUpdateSchema);
    if (body instanceof NextResponse) return body;

    const update: Record<string, unknown> = {};
    if (body.category !== undefined) update.category = body.category;
    if (body.content !== undefined) update.content = body.content;
    if (body.context !== undefined) update.context = body.context;
    if (body.confidence !== undefined) update.confidence = body.confidence;

    const { data: updated, error: updateErr } = await supabase
      .from('advisor_preferences')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateErr) {
      return dbError(updateErr, 'Failed to update preference');
    }

    // Log memory event
    await supabase.from('advisor_memory_events').insert({
      user_id: user.id,
      preference_id: id,
      event_type: 'preference_edited',
      previous_value: current,
      new_value: updated,
      metadata: { fields_changed: Object.keys(update) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('preferences/[id].PATCH', err);
    return dbError({ message: String(err) }, 'Failed to update preference');
  }
}

/**
 * DELETE /api/advisor/preferences/[id]
 * Soft-delete: archives the preference and logs a `preference_deleted` event.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    // Fetch current for audit
    const { data: current } = await supabase
      .from('advisor_preferences')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!current) {
      return notFound('Preference not found');
    }

    // Soft-delete: archive
    const { error: archiveErr } = await supabase
      .from('advisor_preferences')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (archiveErr) {
      return dbError(archiveErr, 'Failed to archive preference');
    }

    // Log memory event
    await supabase.from('advisor_memory_events').insert({
      user_id: user.id,
      preference_id: id,
      event_type: 'preference_deleted',
      previous_value: current,
    });

    return NextResponse.json({ archived: true });
  } catch (err) {
    console.error('preferences/[id].DELETE', err);
    return dbError({ message: String(err) }, 'Failed to archive preference');
  }
}
