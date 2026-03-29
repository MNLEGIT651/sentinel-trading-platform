import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/funding — Fetch bank links and recent funding transactions.
 * POST /api/funding — Initiate a deposit or withdrawal.
 */

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') ?? 'all';

    if (view === 'bank-links') {
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

    if (view === 'transactions') {
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
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action as string | undefined;

    // ─── Create bank link record ────────────────────────────────
    if (action === 'create_bank_link') {
      const broker_account_id = body.broker_account_id as string | undefined;
      const plaid_item_id = body.plaid_item_id as string | undefined;
      const bank_name = body.bank_name as string | undefined;
      const account_last4 = body.account_last4 as string | undefined;
      const account_type = body.account_type as string | undefined;

      if (!broker_account_id) {
        return NextResponse.json({ error: 'broker_account_id is required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('bank_links')
        .insert({
          user_id: user.id,
          broker_account_id,
          plaid_item_id: plaid_item_id ?? null,
          bank_name: bank_name ?? null,
          account_last4: account_last4 ?? null,
          account_type: account_type ?? null,
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
        payload: { bank_link_id: data.id, bank_name },
      });

      return NextResponse.json(data, { status: 201 });
    }

    // ─── Initiate deposit or withdrawal ─────────────────────────
    if (action === 'transfer') {
      const direction = body.direction as string | undefined;
      const amount = Number(body.amount);
      const bank_link_id = body.bank_link_id as string | undefined;
      const broker_account_id = body.broker_account_id as string | undefined;

      if (!direction || !['deposit', 'withdrawal'].includes(direction)) {
        return NextResponse.json(
          { error: 'direction must be deposit or withdrawal' },
          { status: 400 },
        );
      }
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
      }
      if (!bank_link_id || !broker_account_id) {
        return NextResponse.json(
          { error: 'bank_link_id and broker_account_id are required' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('funding_transactions')
        .insert({
          user_id: user.id,
          broker_account_id,
          bank_link_id,
          direction,
          amount,
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
          direction,
          amount,
        },
      });

      return NextResponse.json(data, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use create_bank_link or transfer.' },
      { status: 400 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
