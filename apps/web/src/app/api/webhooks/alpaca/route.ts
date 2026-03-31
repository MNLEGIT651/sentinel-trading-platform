import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseBody } from '@/lib/api/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WebhookBody = z
  .object({
    event: z.string().min(1, 'Missing event type'),
    account_id: z.string().optional(),
    transfer_id: z.string().optional(),
    relationship_id: z.string().optional(),
    status: z.string().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

/**
 * POST /api/webhooks/alpaca ΓÇö Handle Alpaca Broker API webhooks.
 *
 * Alpaca sends webhook events for:
 *   - Account status changes (approved, rejected, action_required)
 *   - Transfer status changes (complete, failed, returned)
 *   - ACH relationship status changes
 *
 * This route uses the service_role key to update records regardless of RLS,
 * since webhooks are server-to-server calls with no user session.
 */
export async function POST(request: Request) {
  try {
    const body = await parseBody(request, WebhookBody);
    if (body instanceof NextResponse) return body;

    const event = body.event;

    // Use service role for webhook updates (no user session)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    switch (event) {
      // ΓöÇΓöÇΓöÇ Account Status Changes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
      case 'account_status': {
        const accountId = body.account_id;
        const accountStatus = body.status;

        if (!accountId || !accountStatus) {
          return NextResponse.json({ error: 'Missing account_id or status' }, { status: 400 });
        }

        // Map Alpaca statuses to our status values
        const statusMap: Record<string, string> = {
          ACTIVE: 'approved',
          APPROVED: 'approved',
          REJECTED: 'rejected',
          ACTION_REQUIRED: 'action_required',
          DISABLED: 'disabled',
          ACCOUNT_CLOSED: 'closed',
        };

        const mappedStatus = statusMap[accountStatus] ?? accountStatus.toLowerCase();

        // Update broker_accounts by external_account_id
        const { data: updated, error } = await supabase
          .from('broker_accounts')
          .update({
            status: mappedStatus,
            ...(mappedStatus === 'approved' ? { approved_at: new Date().toISOString() } : {}),
            ...(mappedStatus === 'rejected' && body.reason
              ? { rejection_reason: body.reason }
              : {}),
          })
          .eq('external_account_id', accountId)
          .select('user_id, id')
          .maybeSingle();

        if (error) {
          console.error('Webhook: failed to update broker account:', error.message);
          return NextResponse.json({ error: 'Update failed' }, { status: 500 });
        }

        // Log to audit
        if (updated) {
          await supabase.from('onboarding_audit_log').insert({
            user_id: updated.user_id,
            event_type: 'broker_status_webhook',
            payload: {
              broker_account_id: updated.id,
              external_account_id: accountId,
              new_status: mappedStatus,
              raw_status: accountStatus,
            },
          });

          // Update onboarding step based on broker status
          if (mappedStatus === 'approved') {
            await supabase
              .from('customer_profiles')
              .update({ onboarding_step: 'kyc_approved' })
              .eq('user_id', updated.user_id);
          } else if (mappedStatus === 'rejected') {
            await supabase
              .from('customer_profiles')
              .update({ onboarding_step: 'kyc_rejected' })
              .eq('user_id', updated.user_id);
          } else if (mappedStatus === 'action_required') {
            await supabase
              .from('customer_profiles')
              .update({ onboarding_step: 'kyc_needs_info' })
              .eq('user_id', updated.user_id);
          }
        }

        return NextResponse.json({ ok: true, status: mappedStatus });
      }

      // ΓöÇΓöÇΓöÇ Transfer Status Changes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
      case 'transfer_status': {
        const transferId = body.transfer_id;
        const transferStatus = body.status;

        if (!transferId || !transferStatus) {
          return NextResponse.json({ error: 'Missing transfer_id or status' }, { status: 400 });
        }

        const txnStatusMap: Record<string, string> = {
          COMPLETE: 'complete',
          FAILED: 'failed',
          RETURNED: 'returned',
          QUEUED: 'queued',
          CANCELED: 'cancelled',
        };

        const mappedTxnStatus = txnStatusMap[transferStatus] ?? transferStatus.toLowerCase();

        const { data: txn, error: txnError } = await supabase
          .from('funding_transactions')
          .update({
            status: mappedTxnStatus,
            ...(mappedTxnStatus === 'complete' ? { completed_at: new Date().toISOString() } : {}),
            ...(mappedTxnStatus === 'failed' && body.reason ? { failure_reason: body.reason } : {}),
          })
          .eq('external_transfer_id', transferId)
          .select('user_id, id, direction, amount')
          .maybeSingle();

        if (txnError) {
          console.error('Webhook: failed to update transfer:', txnError.message);
          return NextResponse.json({ error: 'Update failed' }, { status: 500 });
        }

        if (txn) {
          await supabase.from('onboarding_audit_log').insert({
            user_id: txn.user_id,
            event_type: 'transfer_status_webhook',
            payload: {
              funding_transaction_id: txn.id,
              external_transfer_id: transferId,
              new_status: mappedTxnStatus,
              direction: txn.direction,
              amount: txn.amount,
            },
          });

          // If first deposit completes, advance onboarding
          if (mappedTxnStatus === 'complete' && txn.direction === 'deposit') {
            await supabase
              .from('customer_profiles')
              .update({ onboarding_step: 'funded' })
              .eq('user_id', txn.user_id);
          }
        }

        return NextResponse.json({ ok: true, status: mappedTxnStatus });
      }

      // ΓöÇΓöÇΓöÇ Bank Relationship Status ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
      case 'ach_relationship_status': {
        const relationshipId = body.relationship_id;
        const relStatus = body.status;

        if (!relationshipId || !relStatus) {
          return NextResponse.json({ error: 'Missing relationship_id or status' }, { status: 400 });
        }

        const bankStatusMap: Record<string, string> = {
          APPROVED: 'approved',
          QUEUED: 'queued',
          FAILED: 'failed',
          CANCEL_PENDING: 'cancelled',
        };

        const mappedBankStatus = bankStatusMap[relStatus] ?? relStatus.toLowerCase();

        const { data: bankLink, error: bankError } = await supabase
          .from('bank_links')
          .update({
            status: mappedBankStatus,
            funding_enabled: mappedBankStatus === 'approved',
          })
          .eq('external_bank_link_id', relationshipId)
          .select('user_id, id')
          .maybeSingle();

        if (bankError) {
          console.error('Webhook: failed to update bank link:', bankError.message);
          return NextResponse.json({ error: 'Update failed' }, { status: 500 });
        }

        if (bankLink) {
          await supabase.from('onboarding_audit_log').insert({
            user_id: bankLink.user_id,
            event_type: 'bank_link_status_webhook',
            payload: {
              bank_link_id: bankLink.id,
              external_relationship_id: relationshipId,
              new_status: mappedBankStatus,
            },
          });

          // If bank approved, advance onboarding
          if (mappedBankStatus === 'approved') {
            await supabase
              .from('customer_profiles')
              .update({ onboarding_step: 'bank_linked' })
              .eq('user_id', bankLink.user_id);
          }
        }

        return NextResponse.json({ ok: true, status: mappedBankStatus });
      }

      default:
        return NextResponse.json({ error: `Unknown event type: ${event}` }, { status: 400 });
    }
  } catch (error) {
    console.error('webhooks.alpaca.POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
