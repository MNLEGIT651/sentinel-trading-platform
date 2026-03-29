import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding/paper-account
 *
 * Creates a paper trading account for the user if one doesn't exist.
 * Called during onboarding wizard completion.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user already has a paper account
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('broker', 'paper')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ id: existing.id, already_existed: true });
    }

    // Create paper trading account
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name: 'Paper Trading',
        broker: 'paper',
        initial_capital: 100000,
        is_active: true,
        is_default: true,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to create paper account') },
        { status: 500 },
      );
    }

    // Audit log
    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: 'paper_account_created',
      payload: { account_id: data.id },
    });

    return NextResponse.json({ id: data.id, already_existed: false }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
