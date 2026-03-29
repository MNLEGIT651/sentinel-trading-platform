'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { OnboardingStep } from '@sentinel/shared';

interface WizardStep {
  key: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

interface OnboardingWizardProps {
  onboardingStep: OnboardingStep;
  onComplete: () => void;
}

// ─── Step Components ────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">📈 Paper Trading (Default)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice with simulated money. No risk, full functionality. You can switch to live trading
          later.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">💰 Live Trading (Later)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          When you&apos;re ready, open a brokerage account to trade with real money. This requires
          identity verification and a linked bank account.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        All new accounts start in paper trading mode. You can explore every feature risk-free.
      </p>
    </div>
  );
}

function ProfileStep({
  displayName,
  setDisplayName,
}: {
  displayName: string;
  setDisplayName: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="display-name" className="text-sm font-medium">
          Display Name
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How should we address you?"
          className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        This is shown in the app. You can change it later in settings.
      </p>
    </div>
  );
}

function RiskStep({
  riskLevel,
  setRiskLevel,
}: {
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  setRiskLevel: (v: 'conservative' | 'moderate' | 'aggressive') => void;
}) {
  const profiles = [
    {
      key: 'conservative' as const,
      label: 'Conservative',
      icon: '🛡️',
      desc: 'Max 3% position size, 1% daily loss limit, 8% drawdown halt',
    },
    {
      key: 'moderate' as const,
      label: 'Moderate',
      icon: '⚖️',
      desc: 'Max 5% position size, 2% daily loss limit, 15% drawdown halt',
    },
    {
      key: 'aggressive' as const,
      label: 'Aggressive',
      icon: '🚀',
      desc: 'Max 10% position size, 5% daily loss limit, 25% drawdown halt',
    },
  ];

  return (
    <div className="space-y-3">
      {profiles.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setRiskLevel(p.key)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            riskLevel === p.key
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{p.icon}</span>
            <span className="text-sm font-medium">{p.label}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
        </button>
      ))}
      <p className="text-xs text-muted-foreground">
        These set your initial risk limits. You can fine-tune all parameters in Settings → Risk
        Management.
      </p>
    </div>
  );
}

function ReadyStep() {
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">🎉</div>
      <p className="text-sm text-muted-foreground">
        Your paper trading account is ready. Run a strategy scan to see what the platform finds, or
        explore the dashboard at your own pace.
      </p>
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-left">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What&apos;s next
        </h4>
        <ul className="mt-2 space-y-1 text-sm">
          <li>• Explore the dashboard and market data</li>
          <li>• Run a strategy scan from the Signals page</li>
          <li>• Review portfolio analytics</li>
          <li>• Configure your strategies</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Risk profile → policy values mapping ───────────────────────────

const RISK_PROFILES = {
  conservative: {
    max_position_pct: 3,
    max_sector_pct: 15,
    daily_loss_limit_pct: 1,
    soft_drawdown_pct: 5,
    hard_drawdown_pct: 8,
    max_open_positions: 10,
  },
  moderate: {
    max_position_pct: 5,
    max_sector_pct: 20,
    daily_loss_limit_pct: 2,
    soft_drawdown_pct: 10,
    hard_drawdown_pct: 15,
    max_open_positions: 20,
  },
  aggressive: {
    max_position_pct: 10,
    max_sector_pct: 30,
    daily_loss_limit_pct: 5,
    soft_drawdown_pct: 15,
    hard_drawdown_pct: 25,
    max_open_positions: 30,
  },
};

// ─── Main Wizard ────────────────────────────────────────────────────

export function OnboardingWizard({ onboardingStep, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [riskLevel, setRiskLevel] = useState<'conservative' | 'moderate' | 'aggressive'>(
    'moderate',
  );
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show wizard for users who haven't completed onboarding
    if (onboardingStep === 'app_account_created') {
      setVisible(true);
    }
  }, [onboardingStep]);

  const steps: WizardStep[] = [
    {
      key: 'welcome',
      title: 'Welcome to Sentinel',
      description: "Your algorithmic trading platform. Let's get you set up.",
      component: <WelcomeStep />,
    },
    {
      key: 'profile',
      title: 'About You',
      description: 'Tell us a little about yourself.',
      component: <ProfileStep displayName={displayName} setDisplayName={setDisplayName} />,
    },
    {
      key: 'risk',
      title: 'Risk Preferences',
      description: 'Choose a starting risk profile. You can adjust this anytime.',
      component: <RiskStep riskLevel={riskLevel} setRiskLevel={setRiskLevel} />,
    },
    {
      key: 'ready',
      title: "You're All Set",
      description: 'Your paper trading account is ready to go.',
      component: <ReadyStep />,
    },
  ];

  const completeOnboarding = useCallback(async () => {
    setSaving(true);
    try {
      // Step 1: Save display name and advance to profile_completed
      await fetch('/api/onboarding/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(displayName.trim() ? { legal_name: displayName.trim() } : {}),
          onboarding_step: 'profile_completed',
        }),
      });

      // Step 2: Apply risk profile
      const policy = RISK_PROFILES[riskLevel];
      await fetch('/api/settings/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...policy,
          paper_trading: true,
          auto_trading: false,
          require_confirmation: true,
        }),
      });

      // Step 3: Create paper trading account
      await fetch('/api/onboarding/paper-account', { method: 'POST' });

      // Step 4: Advance to paper_active
      await fetch('/api/onboarding/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_step: 'paper_active' }),
      });

      setVisible(false);
      onComplete();
    } catch {
      // Non-blocking — user can still proceed
      setVisible(false);
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [displayName, riskLevel, onComplete]);

  if (!visible) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        {/* Progress indicators */}
        <div className="mb-6 flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold">{step?.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{step?.description}</p>
        </div>

        <div className="mb-6">{step?.component}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {currentStep > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={saving}
            >
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVisible(false);
                onComplete();
              }}
            >
              Skip for now
            </Button>
          )}

          {isLast ? (
            <Button size="sm" onClick={completeOnboarding} disabled={saving}>
              {saving ? 'Setting up…' : 'Start Trading'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
