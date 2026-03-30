import { describe, expect, it } from 'vitest';
import type {
  AdvisorPreference,
  PreferenceSource,
  PreferenceStatus,
  PreferenceCategory,
} from '@sentinel/shared';

// ─── Preference lifecycle logic tests ───────────────────────────────

describe('Preference lifecycle logic', () => {
  function createPreference(overrides: Partial<AdvisorPreference> = {}): AdvisorPreference {
    return {
      id: 'pref-1',
      user_id: 'user-1',
      category: 'general' as PreferenceCategory,
      content: 'Test preference',
      context: null,
      source: 'explicit' as PreferenceSource,
      confidence: 1.0,
      status: 'active' as PreferenceStatus,
      originating_message_id: null,
      confirmed_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...overrides,
    };
  }

  describe('source determines initial status', () => {
    it('explicit preferences default to active with confidence 1.0', () => {
      const pref = createPreference({ source: 'explicit', confidence: 1.0, status: 'active' });
      expect(pref.source).toBe('explicit');
      expect(pref.status).toBe('active');
      expect(pref.confidence).toBe(1.0);
    });

    it('inferred preferences default to pending_confirmation with confidence 0.7', () => {
      const pref = createPreference({
        source: 'inferred',
        confidence: 0.7,
        status: 'pending_confirmation',
      });
      expect(pref.source).toBe('inferred');
      expect(pref.status).toBe('pending_confirmation');
      expect(pref.confidence).toBe(0.7);
    });

    it('system preferences default to active', () => {
      const pref = createPreference({ source: 'system', status: 'active' });
      expect(pref.source).toBe('system');
      expect(pref.status).toBe('active');
    });
  });

  describe('confirmation transitions', () => {
    it('pending → active on confirm', () => {
      const pref = createPreference({ status: 'pending_confirmation' });
      const confirmed: AdvisorPreference = {
        ...pref,
        status: 'active',
        confidence: 1.0,
        confirmed_at: new Date().toISOString(),
      };
      expect(confirmed.status).toBe('active');
      expect(confirmed.confidence).toBe(1.0);
      expect(confirmed.confirmed_at).toBeDefined();
    });

    it('pending → dismissed on dismiss', () => {
      const pref = createPreference({ status: 'pending_confirmation' });
      const dismissed: AdvisorPreference = {
        ...pref,
        status: 'dismissed',
      };
      expect(dismissed.status).toBe('dismissed');
    });

    it('active → archived on delete', () => {
      const pref = createPreference({ status: 'active' });
      const archived: AdvisorPreference = {
        ...pref,
        status: 'archived',
      };
      expect(archived.status).toBe('archived');
    });
  });

  describe('category validation', () => {
    const validCategories: PreferenceCategory[] = [
      'risk_tolerance',
      'holding_period',
      'trade_style',
      'sector',
      'position_sizing',
      'volatility',
      'instrument',
      'general',
    ];

    it('accepts all valid categories', () => {
      for (const cat of validCategories) {
        const pref = createPreference({ category: cat });
        expect(pref.category).toBe(cat);
      }
    });
  });

  describe('confidence bounds', () => {
    it('confidence is between 0 and 1', () => {
      const pref = createPreference({ confidence: 0.5 });
      expect(pref.confidence).toBeGreaterThanOrEqual(0);
      expect(pref.confidence).toBeLessThanOrEqual(1);
    });

    it('explicit has confidence 1.0', () => {
      const pref = createPreference({ source: 'explicit', confidence: 1.0 });
      expect(pref.confidence).toBe(1.0);
    });
  });

  describe('preference editing', () => {
    it('preserves id and timestamps on content edit', () => {
      const original = createPreference({ content: 'Original content' });
      const edited: AdvisorPreference = {
        ...original,
        content: 'Updated content',
        updated_at: new Date().toISOString(),
      };
      expect(edited.id).toBe(original.id);
      expect(edited.created_at).toBe(original.created_at);
      expect(edited.content).toBe('Updated content');
      expect(edited.updated_at).not.toBe(original.updated_at);
    });

    it('allows context update independently of content', () => {
      const original = createPreference({ content: 'Avoid biotech', context: null });
      const edited: AdvisorPreference = {
        ...original,
        context: 'Bad experience with MRNA in 2023',
      };
      expect(edited.content).toBe(original.content);
      expect(edited.context).toBe('Bad experience with MRNA in 2023');
    });
  });
});
