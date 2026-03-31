import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody, parseSearchParams } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Zod Schemas ────────────────────────────────────────────────────────

const FundingQuerySchema = z.object({
  view: z.enum(['all', 'bank-links', 'transactions']).optional().default('all'),
});

const BankLinkSchema = z.object({
  action: z.literal('create_bank_link'),
  broker_account_id: z.string().min(1, 'broker_account_id is required'),
  plaid_item_id: z.string().optional(),
  bank_name: z.string().optional(),
  account_last4: z.string().optional(),
  account_type: z.string().optional(),
});

const TransferSchema = z.object({
  action: z.literal('transfer'),
  direction: z.enum(['deposit', 'withdrawal']),
  amount: z.number().positive('amount must be a positive number'),
  bank_link_id: z.string().min(1, 'bank_link_id is required'),
  broker_account_id: z.string().min(1, 'broker_account_id is required'),
});

const FundingPostSchema = z.discriminatedUnion('action', [BankLinkSchema, TransferSchema]);

/**
 * GET /api/funding — Fetch bank links and recent funding transactions.
 * POST /api/funding — Initiate a deposit or withdrawal.
 */

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const params = parseSearchParams(request, FundingQuerySchema);
    if (params instanceof NextResponse) return params;

    if (params.view === 'bank-links') {
      const { data, error } = await supabase
        .from('bank_links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error)
        return NextResponse.json(
          { error: safeErrorMessage(error, 'Database error') },
          { status: 500 },
        );
      return NextResponse.json(data);
    }

    if (params.view === 'transactions') {
      const { data, error } = await supabase
        .from('funding_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error)
        return NextResponse.json(
          { error: safeErrorMessage(error, 'Database error') },
          { status: 500 },
        );
      return NextResponse.json(data);
    }

    // Default: return both
    const [bankRes, txnRes] = await Promise.all([
      supabase
        .from('bank_links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('funding_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      bank_links: bankRes.data ?? [],
      transactions: txnRes.data ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const rl = checkApiRateLimit(user.id);
    if (rl) return rl;

    const body = await parseBody(request, FundingPostSchema);
    if (body instanceof NextResponse) return body;

    // ─── Create bank link record ────────────────────────────────
    if (body.action === 'create_bank_link') {
      const { data, error } = await supabase
        .from('bank_links')
        .insert({
          user_id: user.id,
          broker_account_id: body.broker_account_id,
          plaid_item_id: body.plaid_item_id ?? null,
          bank_name: body.bank_name ?? null,
          account_last4: body.account_last4 ?? null,
          account_type: body.account_type ?? null,
          status: 'pending',
        })
        .select()
        .single();

      if (error)
        return NextResponse.json(
          { error: safeErrorMessage(error, 'Database error') },
          { status: 500 },
        );

      await supabase.from('onboarding_audit_log').insert({
        user_id: user.id,
        event_type: 'bank_link_created',
        payload: { bank_link_id: data.id, bank_name: body.bank_name },
      });

      return NextResponse.json(data, { status: 201 });
    }

    // ─── Initiate deposit or withdrawal ───────────────────────────
    const { data, error } = await supabase
      .from('funding_transactions')
      .insert({
        user_id: user.id,
        broker_account_id: body.broker_account_id,
        bank_link_id: body.bank_link_id,
        direction: body.direction,
        amount: body.amount,
        status: 'pending',
      })
      .select()
      .single();

    if (error)
      return NextResponse.json(
        { error: safeErrorMessage(error, 'Database error') },
        { status: 500 },
      );

    await supabase.from('onboarding_audit_log').insert({
      user_id: user.id,
      event_type: 'transfer_initiated',
      payload: {
        funding_transaction_id: data.id,
        direction: body.direction,
        amount: body.amount,
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
