import { describe, it, expect } from 'vitest';
import { OrderSubmitError, mapOrderError } from '@/lib/order-errors';

describe('order-errors', () => {
  describe('mapOrderError — 422 risk blocks', () => {
    it('maps concentration_limit reason to actionable message', () => {
      const err = new OrderSubmitError('Concentration limit exceeded', {
        status: 422,
        reason: 'concentration_limit',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.retryable).toBe(false);
      expect(result.message).toContain('concentration limit');
    });

    it('maps drawdown_limit reason', () => {
      const err = new OrderSubmitError('Drawdown limit reached', {
        status: 422,
        reason: 'drawdown_limit',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.message).toContain('drawdown limit');
    });

    it('maps position_size reason', () => {
      const err = new OrderSubmitError('Position too large', {
        status: 422,
        reason: 'position_size',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.message).toContain('Position size');
    });

    it('maps buying_power reason', () => {
      const err = new OrderSubmitError('Insufficient buying power', {
        status: 422,
        reason: 'buying_power',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.message).toContain('buying power');
    });

    it('maps max_positions reason', () => {
      const err = new OrderSubmitError('Too many open positions', {
        status: 422,
        reason: 'max_positions',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.message).toContain('Maximum number of open positions');
    });

    it('maps sector_exposure reason', () => {
      const err = new OrderSubmitError('Sector limit exceeded', {
        status: 422,
        reason: 'sector_exposure',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.message).toContain('Sector exposure');
    });

    it('maps daily_loss_limit reason', () => {
      const err = new OrderSubmitError('Daily loss limit', {
        status: 422,
        reason: 'daily_loss_limit',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.message).toContain('Daily loss limit');
    });

    it('falls back to sanitized engine message for unknown 422 reason', () => {
      const err = new OrderSubmitError('Some new risk rule triggered', {
        status: 422,
        reason: 'unknown_reason',
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('risk_block');
      expect(result.retryable).toBe(false);
      expect(result.message).toContain('Some new risk rule triggered');
    });

    it('handles 422 without reason code — uses message pattern matching', () => {
      const err = new OrderSubmitError('Insufficient funds for this trade', {
        status: 422,
      });
      const result = mapOrderError(err);
      expect(result.category).toBe('validation');
      expect(result.message).toContain('Insufficient funds');
    });
  });

  describe('mapOrderError — validation failures', () => {
    it('maps 400 to validation guidance', () => {
      const err = new OrderSubmitError('Bad request', { status: 400 });
      const result = mapOrderError(err);
      expect(result.category).toBe('validation');
      expect(result.retryable).toBe(false);
      expect(result.message).toContain('check symbol');
    });

    it('maps 401 to session expired', () => {
      const err = new OrderSubmitError('Unauthorized', { status: 401 });
      const result = mapOrderError(err);
      expect(result.category).toBe('validation');
      expect(result.message).toContain('sign in');
    });

    it('maps 403 to permission error', () => {
      const err = new OrderSubmitError('Forbidden', { status: 403 });
      const result = mapOrderError(err);
      expect(result.category).toBe('validation');
      expect(result.message).toContain('permissions');
    });

    it('maps 404 to symbol not found', () => {
      const err = new OrderSubmitError('Not found', { status: 404 });
      const result = mapOrderError(err);
      expect(result.category).toBe('validation');
      expect(result.message).toContain('Symbol not found');
    });

    it('matches "invalid symbol" in message when status has no guidance', () => {
      const err = new OrderSubmitError('Invalid symbol XYZZ', { status: 450 });
      const result = mapOrderError(err);
      expect(result.message).toContain('Invalid symbol');
    });

    it('matches "market closed" in message', () => {
      const err = new OrderSubmitError('Market is closed', { status: 422 });
      const result = mapOrderError(err);
      expect(result.message).toContain('Market is closed');
    });
  });

  describe('mapOrderError — network/timeout errors', () => {
    it('maps 408 to timeout', () => {
      const err = new OrderSubmitError('Request timeout', { status: 408 });
      const result = mapOrderError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('timed out');
    });

    it('maps 429 to rate limit', () => {
      const err = new OrderSubmitError('Too many requests', { status: 429 });
      const result = mapOrderError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('Too many requests');
    });

    it('handles timeout Error', () => {
      const err = new Error('The operation timed out');
      const result = mapOrderError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('handles network fetch Error', () => {
      const err = new Error('Failed to fetch');
      const result = mapOrderError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('Network error');
    });

    it('handles AbortError', () => {
      const err = new Error('The user aborted a request');
      const result = mapOrderError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });
  });

  describe('mapOrderError — server errors', () => {
    it('maps 500 to engine error', () => {
      const err = new OrderSubmitError('Internal server error', { status: 500 });
      const result = mapOrderError(err);
      expect(result.category).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('maps 502 to engine unreachable', () => {
      const err = new OrderSubmitError('Bad gateway', { status: 502 });
      const result = mapOrderError(err);
      expect(result.category).toBe('server');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('unreachable');
    });

    it('maps 503 to temporarily unavailable', () => {
      const err = new OrderSubmitError('Service unavailable', { status: 503 });
      const result = mapOrderError(err);
      expect(result.category).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('maps 504 to timeout', () => {
      const err = new OrderSubmitError('Gateway timeout', { status: 504 });
      const result = mapOrderError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('maps unknown 5xx status', () => {
      const err = new OrderSubmitError('Unknown error', { status: 599 });
      const result = mapOrderError(err);
      expect(result.category).toBe('server');
      expect(result.retryable).toBe(true);
    });
  });

  describe('mapOrderError — edge cases', () => {
    it('handles non-Error values gracefully', () => {
      const result = mapOrderError('string error');
      expect(result.category).toBe('unknown');
      expect(result.retryable).toBe(true);
    });

    it('handles null gracefully', () => {
      const result = mapOrderError(null);
      expect(result.category).toBe('unknown');
    });

    it('handles undefined gracefully', () => {
      const result = mapOrderError(undefined);
      expect(result.category).toBe('unknown');
    });

    it('sanitizes HTML from error messages', () => {
      const err = new OrderSubmitError('<script>alert("xss")</script>Bad order', {
        status: 422,
        reason: 'unknown_code',
      });
      const result = mapOrderError(err);
      expect(result.message).not.toContain('<script>');
      expect(result.message).not.toContain('</script>');
    });

    it('truncates excessively long messages', () => {
      const longMessage = 'A'.repeat(300);
      const err = new OrderSubmitError(longMessage, { status: 422, reason: 'unknown_code' });
      const result = mapOrderError(err);
      expect(result.message.length).toBeLessThanOrEqual(200);
    });
  });

  describe('OrderSubmitError', () => {
    it('preserves status, reason, and code', () => {
      const err = new OrderSubmitError('test', {
        status: 422,
        reason: 'concentration_limit',
        code: 'upstream',
        retryable: false,
      });
      expect(err.status).toBe(422);
      expect(err.reason).toBe('concentration_limit');
      expect(err.code).toBe('upstream');
      expect(err.retryable).toBe(false);
      expect(err.name).toBe('OrderSubmitError');
      expect(err).toBeInstanceOf(Error);
    });

    it('defaults retryable to false', () => {
      const err = new OrderSubmitError('test', { status: 400 });
      expect(err.retryable).toBe(false);
    });
  });
});
