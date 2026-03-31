import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';
import { getPlaidClient } from '@/lib/plaid-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ExchangeSchema = z.object({
  public_token: z.string().min(1, 'public_token is required'),
  institution_name: z.string().optional(),
});

/**
 * POST /api/plaid/exchange
 *
 * Exchanges a Plaid public token for an access token (server-side only).
 * Stores the link in external_portfolio_links. The access token is NOT
 * stored in the database — it's only used to create the item record.
 * A production implementation would encrypt and store the access_token
 * in a secrets vault for recurring data pulls.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const plaid = getPlaidClient();
    if (!plaid) {
      return NextResponse.json({ error: 'Plaid is not configured' }, { status: 503 });
    }

    const body = await parseBody(request, ExchangeSchema);
    if (body instanceof NextResponse) return body;

    // Exchange public token for access token (server-side only)
    const exchangeResponse = await plaid.itemPublicTokenExchange({
      public_token: body.public_token,
    });

    const itemId = exchangeResponse.data.item_id;
    // NOTE: access_token should be encrypted and stored securely for recurring pulls.
    // For Phase 1 we record the link but don't persist the access_token in the DB.

    // Store the link record
    const { data, error } = await supabase
      .from('external_portfolio_links')
      .insert({
        user_id: user.id,
        provider: 'plaid',
        external_item_id: itemId,
        institution_name: body.institution_name ?? null,
        status: 'active',
        read_only: true,
        last_synced_at: new Date().toISOString(),
      })
      .select('id, institution_name, status, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Failed to save portfolio link') },
        { status: 500 },
      );
    }

    // Audit log
    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: 'external_portfolio_linked',
      payload: { item_id: itemId, institution: body.institution_name },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('plaid.exchange.POST', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
