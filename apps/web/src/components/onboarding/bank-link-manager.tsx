'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Building2, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { BankLink } from '@sentinel/shared';

interface BankLinkManagerProps {
  /** Alpaca broker account ID (required for linking). */
  brokerAccountId: string | null;
  /** Called after a bank link is successfully created. */
  onLinked?: (() => void) | undefined;
}

export function BankLinkManager({ brokerAccountId, onLinked }: BankLinkManagerProps) {
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  // Load existing bank links
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/funding?view=bank-links');
        if (res.ok) {
          const data = (await res.json()) as BankLink[];
          setBankLinks(data);
        }
      } catch {
        // Non-blocking
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const startBankLink = useCallback(async () => {
    if (!brokerAccountId) {
      toast.error('You need an approved brokerage account before linking a bank.');
      return;
    }

    setLinking(true);
    try {
      // 1. Create Plaid Link token for bank auth
      const tokenRes = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: ['auth'] }),
      });

      if (!tokenRes.ok) {
        const err = (await tokenRes.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? 'Failed to create link token');
        return;
      }

      const { link_token } = (await tokenRes.json()) as { link_token: string };

      // 2. Open Plaid Link (dynamic import to avoid SSR issues)
      const PlaidModule = await import('react-plaid-link');
      // Use programmatic open if supported, otherwise fall back
      // For now we'll create a bank link record directly for the sandbox flow
      // In production, react-plaid-link's usePlaidLink hook handles this in-component

      // For sandbox/development, simulate the Plaid Link flow
      // In production, this would open the Plaid Link modal
      void link_token; // Used by Plaid Link in production
      void PlaidModule;

      // 3. Create the bank link record
      const bankRes = await fetch('/api/funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_bank_link',
          broker_account_id: brokerAccountId,
          bank_name: 'Sandbox Bank',
          account_last4: '0000',
          account_type: 'checking',
        }),
      });

      if (!bankRes.ok) {
        const err = (await bankRes.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? 'Failed to link bank');
        return;
      }

      const newLink = (await bankRes.json()) as BankLink;
      setBankLinks((prev) => [newLink, ...prev]);
      toast.success('Bank account linked successfully');
      onLinked?.();
    } catch {
      toast.error('Failed to link bank account');
    } finally {
      setLinking(false);
    }
  }, [brokerAccountId, onLinked]);

  const removeLink = useCallback(async (linkId: string) => {
    // For now, just remove from display
    // In production, also remove the Alpaca ACH relationship
    setBankLinks((prev) => prev.filter((l) => l.id !== linkId));
    toast.success('Bank link removed');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading bank accounts…</span>
      </div>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Bank Accounts
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={startBankLink}
            disabled={linking || !brokerAccountId}
          >
            {linking ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            Link Bank
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Link a bank account for deposits and withdrawals via ACH.
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {bankLinks.length === 0 ? (
          <div className="text-center py-6">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No bank accounts linked yet.</p>
            {!brokerAccountId && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                Open a live brokerage account first.
              </p>
            )}
          </div>
        ) : (
          bankLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="shrink-0">
                {link.status === 'approved' ? (
                  <CheckCircle className="h-4 w-4 text-profit" />
                ) : link.status === 'failed' ? (
                  <AlertCircle className="h-4 w-4 text-loss" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{link.bank_name ?? 'Bank Account'}</p>
                <p className="text-xs text-muted-foreground">
                  {link.account_type ?? 'Account'} ••••{link.account_last4 ?? ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    link.status === 'approved'
                      ? 'text-profit'
                      : link.status === 'failed'
                        ? 'text-loss'
                        : 'text-muted-foreground'
                  }`}
                >
                  {link.status}
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeLink(link.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
