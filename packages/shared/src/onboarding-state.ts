// ─── Onboarding State Machine ───────────────────────────────────────
// Mirrors the CHECK constraint in customer_profiles.onboarding_step.

export const ONBOARDING_STEPS = [
  'app_account_created',
  'profile_completed',
  'paper_active',
  'kyc_submitted',
  'kyc_pending',
  'kyc_needs_info',
  'kyc_approved',
  'kyc_rejected',
  'bank_linked',
  'funded',
  'live_active',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const VALID_ONBOARDING_TRANSITIONS: Record<OnboardingStep, OnboardingStep[]> = {
  app_account_created: ['profile_completed'],
  profile_completed: ['paper_active'],
  paper_active: ['kyc_submitted'],
  kyc_submitted: ['kyc_pending'],
  kyc_pending: ['kyc_approved', 'kyc_needs_info', 'kyc_rejected'],
  kyc_needs_info: ['kyc_submitted'], // resubmit after providing more info
  kyc_approved: ['bank_linked'],
  kyc_rejected: ['kyc_submitted'], // appeal/reapply
  bank_linked: ['funded'],
  funded: ['live_active'],
  live_active: [],
};

export const ONBOARDING_TERMINAL_STEPS: OnboardingStep[] = ['live_active'];

export function isOnboardingTerminal(step: OnboardingStep): boolean {
  return ONBOARDING_TERMINAL_STEPS.includes(step);
}

export function canOnboardingTransition(from: OnboardingStep, to: OnboardingStep): boolean {
  return VALID_ONBOARDING_TRANSITIONS[from].includes(to);
}

export function getValidOnboardingTransitions(step: OnboardingStep): OnboardingStep[] {
  return VALID_ONBOARDING_TRANSITIONS[step];
}

export function validateOnboardingTransition(
  from: OnboardingStep,
  to: OnboardingStep,
): { valid: boolean; error?: string } {
  if (isOnboardingTerminal(from)) {
    return { valid: false, error: `Cannot transition from terminal step '${from}'` };
  }
  if (!canOnboardingTransition(from, to)) {
    const allowed = getValidOnboardingTransitions(from);
    return {
      valid: false,
      error: `Invalid onboarding transition '${from}' → '${to}'. Valid targets: [${allowed.join(', ')}]`,
    };
  }
  return { valid: true };
}

/** Steps that indicate the user can trade (paper or live). */
export function canTrade(step: OnboardingStep): boolean {
  return (
    step === 'paper_active' ||
    step === 'funded' ||
    step === 'live_active' ||
    // KYC in-progress users can still paper trade
    step === 'kyc_submitted' ||
    step === 'kyc_pending' ||
    step === 'kyc_needs_info' ||
    step === 'kyc_approved' ||
    step === 'bank_linked'
  );
}

/** Steps that indicate the user has a live (non-paper) account. */
export function hasLiveAccount(step: OnboardingStep): boolean {
  return (
    step === 'kyc_approved' || step === 'bank_linked' || step === 'funded' || step === 'live_active'
  );
}
