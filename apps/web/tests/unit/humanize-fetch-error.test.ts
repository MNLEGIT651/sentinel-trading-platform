import { describe, it, expect } from 'vitest';
import { humanizeFetchError } from '@/lib/humanize-fetch-error';

describe('humanizeFetchError', () => {
  it('returns default copy for nullish errors', () => {
    expect(humanizeFetchError(null)).toBe('Could not load data.');
    expect(humanizeFetchError(undefined)).toBe('Could not load data.');
  });

  it('uses provided subject in default copy', () => {
    expect(humanizeFetchError(null, { subject: 'market data' })).toBe(
      'Could not load market data.',
    );
  });

  it('maps 503 to a friendly unavailability message', () => {
    expect(
      humanizeFetchError(new Error('Bars fetch failed: 503'), { subject: 'live price history' }),
    ).toBe('Live price history service is temporarily unavailable.');
  });

  it('maps 504 to a friendly upstream timeout message', () => {
    expect(humanizeFetchError(new Error('Engine error: 504'), { subject: 'quotes' })).toBe(
      'Quotes request timed out upstream.',
    );
  });

  it('maps 429 to rate limit messaging regardless of subject', () => {
    expect(humanizeFetchError(new Error('Quotes fetch failed: 429'))).toBe(
      'Rate limit reached. Please retry shortly.',
    );
  });

  it('maps 404 to "no X found"', () => {
    expect(
      humanizeFetchError(new Error('Bars fetch failed: 404'), { subject: 'journal entries' }),
    ).toBe('No journal entries found.');
  });

  it('maps 401/403 to not-authorized', () => {
    expect(humanizeFetchError(new Error('Engine error: 401'))).toBe('Not authorized to load data.');
    expect(humanizeFetchError(new Error('Engine error: 403'))).toBe('Not authorized to load data.');
  });

  it('maps other 5xx to a generic service-trouble message', () => {
    expect(humanizeFetchError(new Error('Bars fetch failed: 500'), { subject: 'quotes' })).toBe(
      'Quotes service is having trouble right now.',
    );
  });

  it('maps other 4xx to a generic error with status', () => {
    expect(humanizeFetchError(new Error('Bars fetch failed: 422'), { subject: 'quotes' })).toBe(
      'Could not load quotes (error 422).',
    );
  });

  it('detects timeouts', () => {
    expect(humanizeFetchError(new Error('The request timed out'))).toBe(
      'Request timed out while loading data.',
    );
    expect(humanizeFetchError(new DOMException('Aborted', 'AbortError'))).toBe(
      'Request timed out while loading data.',
    );
  });

  it('detects network failures', () => {
    expect(humanizeFetchError(new TypeError('Failed to fetch'))).toBe(
      'Network error while loading data.',
    );
  });

  it('falls back to default copy for unrecognized errors', () => {
    expect(humanizeFetchError(new Error('something weird'))).toBe('Could not load data.');
  });

  it('accepts non-Error throwables', () => {
    expect(humanizeFetchError('Engine error: 503')).toBe(
      'Data service is temporarily unavailable.',
    );
  });
});
