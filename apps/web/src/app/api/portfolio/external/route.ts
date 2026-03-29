import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/portfolio/external
 *
 * Lists the user's linked external portfolio accounts (read-only).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portfolio/external
 *
 * Disconnects an external portfolio link.
 * Expects { id: string } in the request body.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    if (!body?.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
