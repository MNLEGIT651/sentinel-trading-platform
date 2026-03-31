import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
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
export async function POST(): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

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
  } catch (error) {
    console.error('plaid.link-token.POST', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
