import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPlaidClient } from '@/lib/plaid-client';
import { Products, CountryCode } from 'plaid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/plaid/link-token
 *
 * Creates a Plaid Link token for the Investments product (read-only).
 * The frontend uses this token to launch Plaid Link.
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

    const plaid = getPlaidClient();
    if (!plaid) {
      return NextResponse.json(
        { error: 'Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.' },
        { status: 503 },
      );
    }

    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Sentinel Trading',
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch {
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
