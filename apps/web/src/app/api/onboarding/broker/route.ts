import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/onboarding/broker — Fetch the user's broker account.
 * POST /api/onboarding/broker — Create a broker account record (status=pending).
 * PUT /api/onboarding/broker — Update broker account status after KYC submission.
 */

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('broker_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error)
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Database error') },
        { status: 500 },
      );

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check for existing broker account
    const { data: existing } = await supabase
      .from('broker_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Broker account already exists' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('broker_accounts')
      .insert({
        user_id: user.id,
        broker_provider: 'alpaca',
        status: 'pending',
        account_type: 'individual',
      })
      .select()
      .single();

    if (error)
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Database error') },
        { status: 500 },
      );

    // Log to audit
    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: 'broker_account_created',
      payload: { broker_account_id: data.id, broker_provider: 'alpaca' },
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;

    // Only allow updating specific fields from client side
    const allowedFields: Record<string, unknown> = {};
    if (typeof body.external_account_id === 'string')
      allowedFields.external_account_id = body.external_account_id;
    if (typeof body.status === 'string') allowedFields.status = body.status;
    if (typeof body.submitted_at === 'string') allowedFields.submitted_at = body.submitted_at;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('broker_accounts')
      .update(allowedFields)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error)
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Database error') },
        { status: 500 },
      );

    // Log status changes to audit
    if (body.status) {
      await supabase.from('onboarding_audit_log').insert({
        user_id: user.id,
        event_type: 'broker_status_changed',
        payload: {
          broker_account_id: data.id,
          new_status: body.status,
        },
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
