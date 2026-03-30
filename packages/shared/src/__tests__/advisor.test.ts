import { describe, expect, it } from 'vitest';
import {
  getProfileCompleteness,
  getConfidenceLabel,
  PREFERENCE_CATEGORY_LABELS,
  PREFERENCE_SOURCE_LABELS,
  MEMORY_EVENT_LABELS,
} from '../advisor';

import type {
  AdvisorProfileData,
  ExplanationPayload,
  PreferenceCategory,
  PreferenceSource,
  PreferenceStatus,
  MemoryEventType,
} from '../advisor';

// ─── getProfileCompleteness ─────────────────────────────────────────

describe('getProfileCompleteness', () => {
  it('returns 0 for empty profile', () => {
    expect(getProfileCompleteness({})).toBe(0);
  });

  it('returns 1 for fully filled profile', () => {
    const full: AdvisorProfileData = {
      risk_tolerance: 'moderate',
      experience_level: 'intermediate',
      investment_horizon: 'swing',
      primary_goal: 'growth',
      account_size_range: '50k_200k',
      preferred_asset_classes: ['equities'],
      preferred_sectors: ['tech'],
      avoided_sectors: ['energy'],
      max_position_pct: 5,
      notes: 'My trading style notes',
    };
    expect(getProfileCompleteness(full)).toBe(1);
  });

  it('returns partial for partially filled profile', () => {
    const partial: AdvisorProfileData = {
      risk_tolerance: 'conservative',
      experience_level: 'beginner',
    };
    const result = getProfileCompleteness(partial);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('does not count empty arrays', () => {
    const profile: AdvisorProfileData = {
      preferred_sectors: [],
      avoided_sectors: [],
    };
    expect(getProfileCompleteness(profile)).toBe(0);
  });
});

// ─── getConfidenceLabel ─────────────────────────────────────────────

describe('getConfidenceLabel', () => {
  it('returns low for 0', () => {
    expect(getConfidenceLabel(0)).toBe('low');
  });

  it('returns low for 0.39', () => {
    expect(getConfidenceLabel(0.39)).toBe('low');
  });

  it('returns medium for 0.4', () => {
    expect(getConfidenceLabel(0.4)).toBe('medium');
  });

  it('returns medium for 0.69', () => {
    expect(getConfidenceLabel(0.69)).toBe('medium');
  });

  it('returns high for 0.75', () => {
    expect(getConfidenceLabel(0.75)).toBe('high');
  });

  it('returns high for 1.0', () => {
    expect(getConfidenceLabel(1.0)).toBe('high');
  });
});

// ─── Label maps ─────────────────────────────────────────────────────

describe('label maps', () => {
  it('PREFERENCE_CATEGORY_LABELS covers all categories', () => {
    const categories: PreferenceCategory[] = [
      'risk_tolerance',
      'holding_period',
      'trade_style',
      'sector',
      'position_sizing',
      'volatility',
      'instrument',
      'general',
    ];
    for (const cat of categories) {
      expect(PREFERENCE_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof PREFERENCE_CATEGORY_LABELS[cat]).toBe('string');
    }
  });

  it('PREFERENCE_SOURCE_LABELS covers all sources', () => {
    const sources: PreferenceSource[] = ['explicit', 'inferred', 'system'];
    for (const src of sources) {
      expect(PREFERENCE_SOURCE_LABELS[src]).toBeDefined();
    }
  });

  it('MEMORY_EVENT_LABELS covers all event types', () => {
    const events: MemoryEventType[] = [
      'profile_updated',
      'preference_learned',
      'preference_confirmed',
      'preference_edited',
      'preference_dismissed',
      'preference_deleted',
      'preference_restored',
      'preference_auto_expired',
    ];
    for (const evt of events) {
      expect(MEMORY_EVENT_LABELS[evt]).toBeDefined();
    }
  });
});

// ─── Type shape guards ──────────────────────────────────────────────

describe('type shapes', () => {
  it('ExplanationPayload has required structure', () => {
    const payload: ExplanationPayload = {
      summary: 'Test summary',
      primary_factors: [
        { name: 'Momentum', description: 'Strong uptrend', impact: 'positive', weight: 0.8 },
      ],
      user_preferences_used: [
        {
          preference_id: 'p1',
          content: 'Prefer swing trades',
          category: 'trade_style',
          how_used: 'Matched holding period',
        },
      ],
      constraints_checked: [{ name: 'Position size', passed: true, limit: '5%', actual: '3%' }],
      risks: [{ name: 'Earnings risk', severity: 'medium', description: 'Earnings next week' }],
      alternatives_considered: [{ name: 'GOOGL', reason_rejected: 'Higher valuation' }],
      confidence: 0.85,
      confidence_label: 'high',
      generated_at: new Date().toISOString(),
    };

    expect(payload.summary).toBeDefined();
    expect(payload.primary_factors).toHaveLength(1);
    expect(payload.user_preferences_used).toHaveLength(1);
    expect(payload.constraints_checked).toHaveLength(1);
    expect(payload.risks).toHaveLength(1);
    expect(payload.alternatives_considered).toHaveLength(1);
    expect(payload.confidence).toBe(0.85);
    expect(payload.confidence_label).toBe('high');
  });

  it('PreferenceStatus values are valid', () => {
    const valid: PreferenceStatus[] = ['active', 'pending_confirmation', 'dismissed', 'archived'];
    expect(valid).toHaveLength(4);
  });
});
