'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CheckCircle, Circle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DisclosuresAcceptance } from '@/components/onboarding/disclosures-acceptance';
import { KycForm } from '@/components/onboarding/kyc-form';
import { BankLinkManager } from '@/components/onboarding/bank-link-manager';
import { FundingPanel } from '@/components/onboarding/funding-panel';
import { useOnboardingProfile } from '@/hooks/use-onboarding';
import type { BrokerAccount } from '@sentinel/shared';

type LiveStep = 'disclosures' | 'kyc' | 'bank' | 'fund';

const STEPS: { key: LiveStep; label: string }[] = [
  { key: 'disclosures', label: 'Disclosures' },
  { key: 'kyc', label: 'Identity' },
  { key: 'bank', label: 'Bank Link' },
  { key: 'fund', label: 'Fund Account' },
];

export default function LiveAccountPage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useOnboardingProfile();
  const [step, setStep] = useState<LiveStep>('disclosures');
  const [brokerAccount, setBrokerAccount] = useState<BrokerAccount | null>(null);
  const [loadingBroker, setLoadingBroker] = useState(true);

  // Load existing broker account
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/onboarding/broker');
        if (res.ok) {
          const data = (await res.json()) as BrokerAccount | null;
          setBrokerAccount(data);
          // Auto-advance based on current state
          if (data?.status === 'approved') {
            setStep('bank');
          } else if (data?.status === 'submitted' || data?.status === 'action_required') {
            setStep('kyc');
          }
        }
      } catch {
        // Non-blocking
      } finally {
        setLoadingBroker(false);
      }
    };
    void load();
  }, []);

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  if (profileLoading || loadingBroker) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Loading…</span>
      </div>
    );
  }

  // Check if user is ready for live onboarding
  const onboardingStep = profile?.onboarding_step;
  if (
    onboardingStep !== 'paper_active' &&
    onboardingStep !== 'kyc_submitted' &&
    onboardingStep !== 'kyc_pending' &&
    onboardingStep !== 'kyc_needs_info' &&
    onboardingStep !== 'kyc_approved' &&
    onboardingStep !== 'bank_linked' &&
    onboardingStep !== 'funded' &&
    onboardingStep !== 'live_active'
  ) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold mb-2">Complete Paper Trading Setup First</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You need to complete the initial onboarding and try paper trading before opening a live
          account.
        </p>
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Open Live Trading Account</h1>
          <p className="text-xs text-muted-foreground">
            Complete these steps to start trading with real money.
          </p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 px-1">
        {STEPS.map((s, idx) => {
          const isActive = s.key === step;
          const isDone = idx < stepIdx;

          return (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : isDone
                    ? 'text-profit hover:bg-profit/10'
                    : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {isDone ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      {step === 'disclosures' && (
        <DisclosuresAcceptance requiredOnly={false} onAllAccepted={() => setStep('kyc')} />
      )}

      {step === 'kyc' && (
        <>
          {brokerAccount?.status === 'submitted' ? (
            <div className="rounded-md border border-border p-6 text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
              <h3 className="text-sm font-semibold mb-1">Application Under Review</h3>
              <p className="text-xs text-muted-foreground">
                Your application has been submitted and is being reviewed. This typically takes 1-3
                business days. You&apos;ll be notified when your account is approved.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Account ID: {brokerAccount.external_account_id ?? '—'}
              </p>
            </div>
          ) : brokerAccount?.status === 'approved' ? (
            <div className="rounded-md border border-profit/50 bg-profit/5 p-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-3 text-profit" />
              <h3 className="text-sm font-semibold mb-1">Account Approved!</h3>
              <p className="text-xs text-muted-foreground">
                Your brokerage account has been approved. Link a bank account to start funding.
              </p>
              <Button size="sm" className="mt-3" onClick={() => setStep('bank')}>
                Link Bank Account
              </Button>
            </div>
          ) : (
            <KycForm
              onSubmitted={(result) => {
                setBrokerAccount((prev) =>
                  prev
                    ? {
                        ...prev,
                        external_account_id: result.account_id,
                        status: 'submitted' as const,
                      }
                    : null,
                );
              }}
              onCancel={() => router.push('/')}
            />
          )}
        </>
      )}

      {step === 'bank' && (
        <BankLinkManager
          brokerAccountId={brokerAccount?.external_account_id ?? null}
          onLinked={() => setStep('fund')}
        />
      )}

      {step === 'fund' && (
        <FundingPanel brokerAccountId={brokerAccount?.external_account_id ?? null} />
      )}
    </div>
  );
}
