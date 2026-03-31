import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DeleteLinkSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

/**
 * GET /api/portfolio/external
 *
 * Lists the user's linked external portfolio accounts (read-only).
 */
export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const { data, error } = await supabase
      .from('external_portfolio_links')
      .select('id, provider, institution_name, status, read_only, last_synced_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch portfolio links') },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('portfolio.external.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portfolio/external
 *
 * Disconnects an external portfolio link.
 * Expects { id: string } in the request body.
 */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, DeleteLinkSchema);
    if (body instanceof NextResponse) return body;

    const { error } = await supabase
      .from('external_portfolio_links')
      .update({ status: 'disconnected' })
      .eq('id', body.id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to disconnect link') },
        { status: 500 },
      );
    }

    // Audit log
    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: 'external_portfolio_disconnected',
      payload: { link_id: body.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('portfolio.external.DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
