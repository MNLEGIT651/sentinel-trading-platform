// Recommendation lifecycle states
export const RECOMMENDATION_STATES = [
  'detected',
  'analyzed',
  'risk_checked',
  'pending_approval',
  'approved',
  'rejected',
  'risk_blocked',
  'submitted',
  'partially_filled',
  'filled',
  'cancelled',
  'failed',
  'reviewed',
] as const;

export type RecommendationState = (typeof RECOMMENDATION_STATES)[number];

// Valid transitions map
const VALID_TRANSITIONS: Record<RecommendationState, RecommendationState[]> = {
  detected: ['analyzed'],
  analyzed: ['risk_checked'],
  risk_checked: ['pending_approval', 'risk_blocked'],
  pending_approval: ['approved', 'rejected'],
  approved: ['submitted'],
  rejected: [],
  risk_blocked: [],
  submitted: ['filled', 'partially_filled', 'cancelled', 'failed'],
  partially_filled: ['filled', 'cancelled'],
  filled: ['reviewed'],
  cancelled: [],
  failed: ['submitted'], // retry
  reviewed: [],
};

// Terminal states (no valid transitions out)
export const TERMINAL_STATES: RecommendationState[] = [
  'rejected',
  'risk_blocked',
  'cancelled',
  'reviewed',
];

export function isTerminalState(state: RecommendationState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function canTransition(from: RecommendationState, to: RecommendationState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getValidTransitions(state: RecommendationState): RecommendationState[] {
  return VALID_TRANSITIONS[state];
}

export function validateTransition(
  from: RecommendationState,
  to: RecommendationState,
): { valid: boolean; error?: string } {
  if (isTerminalState(from)) {
    return { valid: false, error: `Cannot transition from terminal state '${from}'` };
  }
  if (!canTransition(from, to)) {
    const allowed = getValidTransitions(from);
    return {
      valid: false,
      error: `Invalid transition '${from}' → '${to}'. Valid targets: [${allowed.join(', ')}]`,
    };
  }
  return { valid: true };
}
