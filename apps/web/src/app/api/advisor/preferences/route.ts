import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { parseBody } from '@/lib/api/validation';
import { dbError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/preferences
 * List user preferences, filterable by status and category.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);
    const offset = Number(searchParams.get('offset') ?? 0);

    let query = supabase
      .from('advisor_preferences')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    // Default: exclude archived unless explicitly requested
    if (searchParams.get('include_archived') !== 'true') {
      query = query.neq('status', 'archived');
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return dbError(error, 'Failed to list preferences');
    }

    return NextResponse.json({ preferences: data, total: count });
  } catch (err) {
    console.error('preferences.GET', err);
    return dbError({ message: String(err) }, 'Failed to list preferences');
  }
}

/**
 * POST /api/advisor/preferences
 * Create a new preference. Logs a `preference_learned` memory event.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const PreferenceCreateSchema = z.object({
    category: z.string().min(1, 'category is required'),
    content: z.string().min(1, 'content is required'),
    context: z.string().nullish(),
    source: z.enum(['explicit', 'inferred']).optional(),
    confidence: z.number().min(0).max(1).optional(),
    status: z.string().optional(),
    originating_message_id: z.string().nullish(),
  });

  try {
    const body = await parseBody(req, PreferenceCreateSchema);
    if (body instanceof NextResponse) return body;

    // Inferred preferences default to pending_confirmation
    const source = body.source ?? 'explicit';
    const status = body.status ?? (source === 'inferred' ? 'pending_confirmation' : 'active');
    const confidence = body.confidence ?? (source === 'explicit' ? 1.0 : 0.7);

    const { data: pref, error: insertErr } = await supabase
      .from('advisor_preferences')
      .insert({
        user_id: user.id,
        category: body.category,
        content: body.content,
        context: body.context ?? null,
        source,
        confidence,
        status,
        originating_message_id: body.originating_message_id ?? null,
        confirmed_at: status === 'active' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertErr) {
      return dbError(insertErr, 'Failed to create preference');
    }

    // Log memory event
    await supabase.from('advisor_memory_events').insert({
      user_id: user.id,
      preference_id: pref.id,
      event_type: 'preference_learned',
      new_value: pref,
      metadata: { source, initial_status: status },
    });

    return NextResponse.json(pref, { status: 201 });
  } catch (err) {
    console.error('preferences.POST', err);
    return dbError({ message: String(err) }, 'Failed to create preference');
  }
}
