import { describe, expect, it } from 'vitest';

import { LIVE_TRADING_DISCLOSURES } from '../types';
import type { ConsentDocumentType, DisclosureDocument } from '../types';

describe('onboarding shared types', () => {
  describe('LIVE_TRADING_DISCLOSURES', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(LIVE_TRADING_DISCLOSURES)).toBe(true);
      expect(LIVE_TRADING_DISCLOSURES.length).toBeGreaterThan(0);
    });

    it('each disclosure has required fields', () => {
      for (const doc of LIVE_TRADING_DISCLOSURES) {
        expect(doc).toHaveProperty('type');
        expect(doc).toHaveProperty('version');
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('summary');
        expect(doc).toHaveProperty('required');
        expect(typeof doc.type).toBe('string');
        expect(typeof doc.version).toBe('string');
        expect(typeof doc.title).toBe('string');
        expect(typeof doc.summary).toBe('string');
        expect(typeof doc.required).toBe('boolean');
      }
    });

    it('includes core regulatory disclosures', () => {
      const types = LIVE_TRADING_DISCLOSURES.map((d: DisclosureDocument) => d.type);
      expect(types).toContain('terms_of_service');
      expect(types).toContain('privacy_policy');
      expect(types).toContain('customer_agreement');
    });

    it('all disclosures have valid ConsentDocumentType', () => {
      const validTypes: ConsentDocumentType[] = [
        'terms_of_service',
        'privacy_policy',
        'electronic_delivery',
        'customer_agreement',
        'data_sharing',
        'broker_disclosures',
        'margin_disclosure',
        'risk_disclosure',
      ];
      for (const doc of LIVE_TRADING_DISCLOSURES) {
        expect(validTypes).toContain(doc.type);
      }
    });

    it('has no duplicate disclosure types', () => {
      const types = LIVE_TRADING_DISCLOSURES.map((d: DisclosureDocument) => d.type);
      const unique = new Set(types);
      expect(unique.size).toBe(types.length);
    });

    it('all versions follow semver format', () => {
      for (const doc of LIVE_TRADING_DISCLOSURES) {
        expect(doc.version).toMatch(/^\d+\.\d+$/);
      }
    });
  });
});
