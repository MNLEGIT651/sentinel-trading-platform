import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/onboarding/broker — Fetch the user's broker account.
 * POST /api/onboarding/broker — Create a broker account record (status=pending).
 * PUT /api/onboarding/broker — Update broker account status after KYC submission.
 */

// ─── Zod Schemas ────────────────────────────────────────────────────────

const BrokerUpdateSchema = z
  .object({
    external_account_id: z.string().optional(),
    status: z.string().optional(),
    submitted_at: z.string().optional(),
  })
  .refine(
    (data) =>
      data.external_account_id !== undefined ||
      data.status !== undefined ||
      data.submitted_at !== undefined,
    { message: 'No valid fields to update' },
  );

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

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
  } catch (error) {
    console.error('onboarding.broker.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

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
  } catch (error) {
    console.error('onboarding.broker.POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, BrokerUpdateSchema);
    if (body instanceof NextResponse) return body;

    const { data, error } = await supabase
      .from('broker_accounts')
      .update(body)
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
  } catch (error) {
    console.error('onboarding.broker.PUT', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
