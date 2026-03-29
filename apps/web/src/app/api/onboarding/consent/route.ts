import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';
import type { Consent, ConsentRecord, ConsentDocumentType } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_DOCUMENT_TYPES: ConsentDocumentType[] = [
  'terms_of_service',
  'privacy_policy',
  'electronic_delivery',
  'customer_agreement',
  'data_sharing',
  'broker_disclosures',
  'margin_disclosure',
  'risk_disclosure',
];

// ─── GET: List user's consent records ───────────────────────────────

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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Record a new consent acceptance ──────────────────────────

function validateConsentRecord(
  body: unknown,
): { valid: true; data: ConsentRecord } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const raw = body as Record<string, unknown>;

  if (
    typeof raw.document_type !== 'string' ||
    !VALID_DOCUMENT_TYPES.includes(raw.document_type as ConsentDocumentType)
  ) {
    return {
      valid: false,
      error: `document_type must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`,
    };
  }

  if (typeof raw.document_version !== 'string' || raw.document_version.trim().length === 0) {
    return { valid: false, error: 'document_version is required' };
  }

  return {
    valid: true,
    data: {
      document_type: raw.document_type as ConsentDocumentType,
      document_version: raw.document_version.trim(),
    },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validation = validateConsentRecord(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const ua = request.headers.get('user-agent') ?? null;

    const { data, error } = await supabase
      .from('consents')
      .upsert(
        {
          user_id: user.id,
          document_type: validation.data.document_type,
          document_version: validation.data.document_version,
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
        document_type: validation.data.document_type,
        document_version: validation.data.document_version,
      },
    });

    return NextResponse.json(data as Consent, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
