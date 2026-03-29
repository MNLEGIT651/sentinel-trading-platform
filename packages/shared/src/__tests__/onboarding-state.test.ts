import { describe, expect, it } from 'vitest';

import {
  ONBOARDING_STEPS,
  ONBOARDING_TERMINAL_STEPS,
  canOnboardingTransition,
  canTrade,
  getValidOnboardingTransitions,
  hasLiveAccount,
  isOnboardingTerminal,
  validateOnboardingTransition,
} from '../onboarding-state';

describe('onboarding-state', () => {
  describe('ONBOARDING_STEPS', () => {
    it('contains exactly 11 steps', () => {
      expect(ONBOARDING_STEPS).toHaveLength(11);
    });

    it('starts with app_account_created and ends with live_active', () => {
      expect(ONBOARDING_STEPS[0]).toBe('app_account_created');
      expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe('live_active');
    });

    it('includes all expected KYC states', () => {
      expect(ONBOARDING_STEPS).toContain('kyc_submitted');
      expect(ONBOARDING_STEPS).toContain('kyc_pending');
      expect(ONBOARDING_STEPS).toContain('kyc_needs_info');
      expect(ONBOARDING_STEPS).toContain('kyc_approved');
      expect(ONBOARDING_STEPS).toContain('kyc_rejected');
    });
  });

  describe('isOnboardingTerminal', () => {
    it('live_active is terminal', () => {
      expect(isOnboardingTerminal('live_active')).toBe(true);
    });

    it('non-terminal steps return false', () => {
      const nonTerminal = ONBOARDING_STEPS.filter((s) => !ONBOARDING_TERMINAL_STEPS.includes(s));
      for (const step of nonTerminal) {
        expect(isOnboardingTerminal(step)).toBe(false);
      }
    });
  });

  describe('canOnboardingTransition', () => {
    it('allows valid forward transitions', () => {
      expect(canOnboardingTransition('app_account_created', 'profile_completed')).toBe(true);
      expect(canOnboardingTransition('profile_completed', 'paper_active')).toBe(true);
      expect(canOnboardingTransition('paper_active', 'kyc_submitted')).toBe(true);
      expect(canOnboardingTransition('kyc_submitted', 'kyc_pending')).toBe(true);
      expect(canOnboardingTransition('kyc_pending', 'kyc_approved')).toBe(true);
      expect(canOnboardingTransition('kyc_pending', 'kyc_needs_info')).toBe(true);
      expect(canOnboardingTransition('kyc_pending', 'kyc_rejected')).toBe(true);
      expect(canOnboardingTransition('kyc_approved', 'bank_linked')).toBe(true);
      expect(canOnboardingTransition('bank_linked', 'funded')).toBe(true);
      expect(canOnboardingTransition('funded', 'live_active')).toBe(true);
    });

    it('allows resubmission after needs_more_info', () => {
      expect(canOnboardingTransition('kyc_needs_info', 'kyc_submitted')).toBe(true);
    });

    it('allows reapplication after rejection', () => {
      expect(canOnboardingTransition('kyc_rejected', 'kyc_submitted')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canOnboardingTransition('app_account_created', 'kyc_submitted')).toBe(false);
      expect(canOnboardingTransition('paper_active', 'live_active')).toBe(false);
      expect(canOnboardingTransition('kyc_approved', 'kyc_submitted')).toBe(false);
      expect(canOnboardingTransition('funded', 'bank_linked')).toBe(false);
    });

    it('live_active has no valid transitions', () => {
      for (const step of ONBOARDING_STEPS) {
        expect(canOnboardingTransition('live_active', step)).toBe(false);
      }
    });
  });

  describe('getValidOnboardingTransitions', () => {
    it('returns correct targets for each step', () => {
      expect(getValidOnboardingTransitions('app_account_created')).toEqual(['profile_completed']);
      expect(getValidOnboardingTransitions('kyc_pending')).toEqual([
        'kyc_approved',
        'kyc_needs_info',
        'kyc_rejected',
      ]);
      expect(getValidOnboardingTransitions('live_active')).toEqual([]);
    });
  });

  describe('validateOnboardingTransition', () => {
    it('returns valid:true for allowed transitions', () => {
      const result = validateOnboardingTransition('app_account_created', 'profile_completed');
      expect(result).toEqual({ valid: true });
    });

    it('returns error for terminal step transitions', () => {
      const result = validateOnboardingTransition('live_active', 'app_account_created');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terminal step');
    });

    it('returns error for invalid non-terminal transitions', () => {
      const result = validateOnboardingTransition('paper_active', 'live_active');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid onboarding transition');
      expect(result.error).toContain('kyc_submitted');
    });
  });

  describe('canTrade', () => {
    it('returns true for paper_active', () => {
      expect(canTrade('paper_active')).toBe(true);
    });

    it('returns true for KYC-in-progress states (can still paper trade)', () => {
      expect(canTrade('kyc_submitted')).toBe(true);
      expect(canTrade('kyc_pending')).toBe(true);
      expect(canTrade('kyc_needs_info')).toBe(true);
      expect(canTrade('kyc_approved')).toBe(true);
      expect(canTrade('bank_linked')).toBe(true);
    });

    it('returns true for funded and live_active', () => {
      expect(canTrade('funded')).toBe(true);
      expect(canTrade('live_active')).toBe(true);
    });

    it('returns false for pre-trading states', () => {
      expect(canTrade('app_account_created')).toBe(false);
      expect(canTrade('profile_completed')).toBe(false);
    });

    it('returns false for rejected', () => {
      expect(canTrade('kyc_rejected')).toBe(false);
    });
  });

  describe('hasLiveAccount', () => {
    it('returns true for live-capable states', () => {
      expect(hasLiveAccount('kyc_approved')).toBe(true);
      expect(hasLiveAccount('bank_linked')).toBe(true);
      expect(hasLiveAccount('funded')).toBe(true);
      expect(hasLiveAccount('live_active')).toBe(true);
    });

    it('returns false for pre-live states', () => {
      expect(hasLiveAccount('app_account_created')).toBe(false);
      expect(hasLiveAccount('profile_completed')).toBe(false);
      expect(hasLiveAccount('paper_active')).toBe(false);
      expect(hasLiveAccount('kyc_submitted')).toBe(false);
      expect(hasLiveAccount('kyc_pending')).toBe(false);
      expect(hasLiveAccount('kyc_needs_info')).toBe(false);
      expect(hasLiveAccount('kyc_rejected')).toBe(false);
    });
  });
});
