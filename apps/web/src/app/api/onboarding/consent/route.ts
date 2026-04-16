import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';
import type { Consent } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ConsentRecordSchema = z.object({
  document_type: z.enum([
    'terms_of_service',
    'privacy_policy',
    'electronic_delivery',
    'customer_agreement',
    'data_sharing',
    'broker_disclosures',
    'margin_disclosure',
    'risk_disclosure',
  ]),
  document_version: z.string().trim().min(1, 'document_version is required'),
});

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('user_id', user.id)
      .order('accepted_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch consents') },
        { status: 500 },
      );
    }

    return NextResponse.json(data as Consent[]);
  } catch (error) {
    console.error('onboarding.consent.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, ConsentRecordSchema);
    if (body instanceof NextResponse) return body;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const ua = request.headers.get('user-agent') ?? null;

    const { data, error } = await supabase
      .from('consents')
      .upsert(
        {
          user_id: user.id,
          document_type: body.document_type,
          document_version: body.document_version,
          ip_address: ip,
          user_agent: ua,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,document_type,document_version' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to record consent') },
        { status: 500 },
      );
    }

    // Audit log
    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: 'consent_accepted',
      payload: {
        document_type: body.document_type,
        document_version: body.document_version,
      },
    });

    return NextResponse.json(data as Consent, { status: 201 });
  } catch (error) {
    console.error('onboarding.consent.POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
