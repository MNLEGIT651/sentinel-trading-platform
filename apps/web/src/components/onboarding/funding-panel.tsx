'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { FundingTransaction, BankLink } from '@sentinel/shared';

interface FundingPanelProps {
  /** User's broker account ID (required for transfers). */
  brokerAccountId: string | null;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  complete: CheckCircle,
  failed: AlertCircle,
  returned: AlertCircle,
};

export function FundingPanel({ brokerAccountId }: FundingPanelProps) {
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const [transactions, setTransactions] = useState<FundingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [direction, setDirection] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load funding data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/funding');
        if (res.ok) {
          const data = (await res.json()) as {
            bank_links: BankLink[];
            transactions: FundingTransaction[];
          };
          setBankLinks(data.bank_links);
          setTransactions(data.transactions);
          if (data.bank_links.length > 0 && !selectedBank) {
            const first = data.bank_links[0];
            if (first) {
              setSelectedBank(first.id);
            }
          }
        }
      } catch {
        // Non-blocking
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTransfer = useCallback(async () => {
    if (!brokerAccountId || !selectedBank || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Enter a valid positive amount');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          direction,
          amount: numAmount,
          bank_link_id: selectedBank,
          broker_account_id: brokerAccountId,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? 'Transfer failed');
        return;
      }

      const txn = (await res.json()) as FundingTransaction;
      setTransactions((prev) => [txn, ...prev]);
      setAmount('');
      toast.success(
        `${direction === 'deposit' ? 'Deposit' : 'Withdrawal'} of $${numAmount.toFixed(2)} initiated`,
      );
    } catch {
      toast.error('Transfer failed');
    } finally {
      setSubmitting(false);
    }
  }, [brokerAccountId, selectedBank, amount, direction]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading funding data…</span>
      </div>
    );
  }

  const hasApprovedBank = bankLinks.some((b) => b.status === 'approved' || b.status === 'pending');

  return (
    <div className="space-y-4">
      {/* Transfer form */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Fund Your Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasApprovedBank ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Link a bank account first to enable deposits and withdrawals.
              </p>
            </div>
          ) : (
            <>
              {/* Direction toggle */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={direction === 'deposit' ? 'default' : 'outline'}
                  onClick={() => setDirection('deposit')}
                  className="flex-1"
                >
                  <ArrowDownCircle className="h-3 w-3 mr-1" />
                  Deposit
                </Button>
                <Button
                  size="sm"
                  variant={direction === 'withdrawal' ? 'default' : 'outline'}
                  onClick={() => setDirection('withdrawal')}
                  className="flex-1"
                >
                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                  Withdraw
                </Button>
              </div>

              {/* Bank select */}
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Bank Account</span>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {bankLinks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name ?? 'Bank'} ••••{b.account_last4 ?? ''} (
                      {b.account_type ?? 'account'})
                    </option>
                  ))}
                </select>
              </label>

              {/* Amount */}
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Amount (USD)</span>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="block w-full rounded-md border border-border bg-background pl-7 pr-3 py-1.5 text-sm"
                  />
                </div>
              </label>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {['100', '500', '1000', '5000'].map((preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant="outline"
                    onClick={() => setAmount(preset)}
                    className="flex-1 text-xs"
                  >
                    ${preset}
                  </Button>
                ))}
              </div>

              <Button
                className="w-full"
                size="sm"
                onClick={submitTransfer}
                disabled={submitting || !amount || !selectedBank}
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : direction === 'deposit' ? (
                  <ArrowDownCircle className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                )}
                {direction === 'deposit' ? 'Deposit' : 'Withdraw'} ${amount || '0.00'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {transactions.map((txn) => {
              const StatusIcon = STATUS_ICONS[txn.status] ?? Clock;
              const isDeposit = txn.direction === 'deposit';

              return (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 rounded-md border border-border/50 p-2"
                >
                  <StatusIcon
                    className={`h-4 w-4 shrink-0 ${
                      txn.status === 'complete'
                        ? 'text-profit'
                        : txn.status === 'failed' || txn.status === 'returned'
                          ? 'text-loss'
                          : 'text-muted-foreground'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isDeposit ? (
                        <ArrowDownCircle className="h-3 w-3 text-profit" />
                      ) : (
                        <ArrowUpCircle className="h-3 w-3 text-loss" />
                      )}
                      <span className="text-xs font-medium">
                        {isDeposit ? 'Deposit' : 'Withdrawal'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isDeposit ? 'text-profit' : 'text-loss'}`}>
                      {isDeposit ? '+' : '-'}${Number(txn.amount).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">{txn.status}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
