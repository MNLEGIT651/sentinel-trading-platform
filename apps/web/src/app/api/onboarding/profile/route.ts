import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';
import type { CustomerProfile, CustomerProfileUpdate } from '@sentinel/shared';
import { ONBOARDING_STEPS, canOnboardingTransition } from '@sentinel/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── GET: Fetch customer profile ────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const { data, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to fetch profile') },
        { status: 500 },
      );
    }

    if (!data) {
      // Auto-create if trigger hasn't fired (e.g. user created before migration)
      const { data: created, error: insertError } = await supabase
        .from('customer_profiles')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: safeErrorMessage(insertError, 'Failed to create profile') },
          { status: 500 },
        );
      }

      return NextResponse.json(created as CustomerProfile);
    }

    return NextResponse.json(data as CustomerProfile);
  } catch (error) {
    console.error('onboarding.profile.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT: Update customer profile ───────────────────────────────────

const ALLOWED_FIELDS = [
  'legal_name',
  'date_of_birth',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'country',
  'phone',
  'tax_residency',
  'citizenship',
] as const;

function validateProfileUpdate(
  body: unknown,
  currentStep?: string,
): { valid: true; data: CustomerProfileUpdate } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const raw = body as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (field in raw) {
      const val = raw[field];
      if (val !== null && typeof val !== 'string') {
        return { valid: false, error: `${field} must be a string or null` };
      }
      update[field] = val;
    }
  }

  // Validate onboarding_step transition
  if ('onboarding_step' in raw) {
    const newStep = raw.onboarding_step;
    if (typeof newStep !== 'string' || !ONBOARDING_STEPS.includes(newStep as never)) {
      return { valid: false, error: `Invalid onboarding step: ${String(newStep)}` };
    }
    if (currentStep && !canOnboardingTransition(currentStep as never, newStep as never)) {
      return {
        valid: false,
        error: `Cannot transition from '${currentStep}' to '${newStep}'`,
      };
    }
    update.onboarding_step = newStep;
  }

  if (Object.keys(update).length === 0) {
    return { valid: false, error: 'No valid fields provided' };
  }

  return { valid: true, data: update as CustomerProfileUpdate };
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = await checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await request.json().catch(() => null);

    // Fetch current profile for step-transition validation
    let currentStep: string | undefined;
    if (body && typeof body === 'object' && 'onboarding_step' in body) {
      const { data: current } = await supabase
        .from('customer_profiles')
        .select('onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle();
      currentStep = current?.onboarding_step ?? undefined;
    }

    const validation = validateProfileUpdate(body, currentStep);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('customer_profiles')
      .update(validation.data)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to update profile') },
        { status: 500 },
      );
    }

    // Audit log
    const eventType =
      'onboarding_step' in validation.data ? 'onboarding_step_changed' : 'profile_updated';
    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: eventType,
      payload: {
        fields_updated: Object.keys(validation.data),
        ...(currentStep ? { from_step: currentStep } : {}),
        ...('onboarding_step' in validation.data
          ? { to_step: validation.data.onboarding_step }
          : {}),
      },
    });

    return NextResponse.json(data as CustomerProfile);
  } catch (error) {
    console.error('onboarding.profile.PUT', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
