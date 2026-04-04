/**
 * Order error mapping — translates engine error responses into actionable UI messages.
 *
 * The engine returns structured errors with HTTP status codes and reason strings.
 * This module maps those into user-friendly, verbatim-safe guidance.
 */

// ---------------------------------------------------------------------------
// OrderSubmitError — preserves upstream status + reason from the engine
// ---------------------------------------------------------------------------

export interface OrderErrorDetails {
  /** HTTP status from engine (e.g. 422, 400, 503) */
  status: number;
  /** Upstream reason string from the engine body (e.g. "concentration_limit") */
  reason?: string;
  /** Service error code from proxy layer */
  code?: string;
  /** Whether the user could retry this request */
  retryable?: boolean;
}

export class OrderSubmitError extends Error {
  readonly status: number;
  readonly reason: string | undefined;
  readonly code: string | undefined;
  readonly retryable: boolean;

  constructor(message: string, details: OrderErrorDetails) {
    super(message);
    this.name = 'OrderSubmitError';
    this.status = details.status;
    this.reason = details.reason;
    this.code = details.code;
    this.retryable = details.retryable ?? false;
    // Required for proper instanceof in transpiled environments
    Object.setPrototypeOf(this, OrderSubmitError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Error category — drives UI styling
// ---------------------------------------------------------------------------

export type OrderErrorCategory = 'risk_block' | 'validation' | 'network' | 'server' | 'unknown';

export interface MappedOrderError {
  /** User-facing message — safe to display verbatim */
  message: string;
  /** Category for UI styling (color, icon) */
  category: OrderErrorCategory;
  /** Whether the user might succeed by retrying */
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// 422 risk-block reason → actionable guidance
// ---------------------------------------------------------------------------

const RISK_BLOCK_REASONS: Record<string, string> = {
  concentration_limit: 'Position would exceed concentration limit. Reduce quantity or diversify.',
  drawdown_limit: 'Portfolio drawdown limit reached. Wait for recovery or reduce exposure.',
  position_size: 'Position size exceeds allowed maximum. Try a smaller quantity.',
  max_positions: 'Maximum number of open positions reached. Close a position first.',
  sector_exposure: 'Sector exposure limit would be exceeded. Diversify across sectors.',
  buying_power: 'Insufficient buying power. Deposit funds or reduce order size.',
  daily_loss_limit: 'Daily loss limit reached. Trading resumes next session.',
};

// ---------------------------------------------------------------------------
// HTTP status → guidance (non-422)
// ---------------------------------------------------------------------------

const STATUS_GUIDANCE: Record<
  number,
  { message: string; category: OrderErrorCategory; retryable: boolean }
> = {
  400: {
    message: 'Invalid order — check symbol, quantity, and price fields.',
    category: 'validation',
    retryable: false,
  },
  401: {
    message: 'Session expired — please sign in again.',
    category: 'validation',
    retryable: false,
  },
  403: {
    message: 'Not authorized to place orders. Check account permissions.',
    category: 'validation',
    retryable: false,
  },
  404: {
    message: 'Symbol not found — verify the ticker is correct.',
    category: 'validation',
    retryable: false,
  },
  408: {
    message: 'Request timed out — the engine may be busy. Try again.',
    category: 'network',
    retryable: true,
  },
  429: {
    message: 'Too many requests — wait a moment and try again.',
    category: 'network',
    retryable: true,
  },
  500: {
    message: 'Engine error — please try again shortly.',
    category: 'server',
    retryable: true,
  },
  502: {
    message: 'Engine unreachable — the service may be restarting. Try again.',
    category: 'server',
    retryable: true,
  },
  503: {
    message: 'Engine temporarily unavailable — try again in a few seconds.',
    category: 'server',
    retryable: true,
  },
  504: {
    message: 'Engine did not respond in time — try again.',
    category: 'network',
    retryable: true,
  },
};

// ---------------------------------------------------------------------------
// Validation-related keywords in error messages
// ---------------------------------------------------------------------------

const VALIDATION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid.?symbol/i, message: 'Invalid symbol — check the ticker and try again.' },
  {
    pattern: /insufficient.?(funds?|buying.?power|balance)/i,
    message: 'Insufficient funds — deposit more or reduce order size.',
  },
  {
    pattern: /market.*?(closed|hours|not.?open)/i,
    message: 'Market is closed — orders can be placed during trading hours.',
  },
  {
    pattern: /duplicate.?order/i,
    message: 'Duplicate order detected — check your recent orders.',
  },
  {
    pattern: /min(imum)?.?(order|quantity|qty)/i,
    message: 'Order quantity is below the minimum. Increase the quantity.',
  },
];

// ---------------------------------------------------------------------------
// Type guard — robust across module boundaries
// ---------------------------------------------------------------------------

function isOrderSubmitError(err: unknown): err is OrderSubmitError {
  return (
    err instanceof OrderSubmitError ||
    (err instanceof Error &&
      err.name === 'OrderSubmitError' &&
      'status' in err &&
      typeof (err as OrderSubmitError).status === 'number')
  );
}

// ---------------------------------------------------------------------------
// mapOrderError — the main entry point
// ---------------------------------------------------------------------------

export function mapOrderError(err: unknown): MappedOrderError {
  if (isOrderSubmitError(err)) {
    return mapStructuredError(err);
  }

  if (err instanceof Error) {
    return mapGenericError(err);
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    category: 'unknown',
    retryable: true,
  };
}

function mapStructuredError(err: OrderSubmitError): MappedOrderError {
  // 422 risk blocks — try reason code first, then message pattern matching
  if (err.status === 422) {
    if (err.reason && RISK_BLOCK_REASONS[err.reason]) {
      return {
        message: RISK_BLOCK_REASONS[err.reason]!,
        category: 'risk_block',
        retryable: false,
      };
    }

    const patternMatch = matchValidationPattern(err.message);
    if (patternMatch) return patternMatch;

    // 422 with unrecognized reason — surface the engine message safely
    return {
      message: sanitizeMessage(err.message),
      category: 'risk_block',
      retryable: false,
    };
  }

  // Other known HTTP statuses
  const statusEntry = STATUS_GUIDANCE[err.status];
  if (statusEntry) return statusEntry;

  const patternMatch = matchValidationPattern(err.message);
  if (patternMatch) return patternMatch;

  if (err.status >= 500) {
    return {
      message: `Engine error (${err.status}) — please try again shortly.`,
      category: 'server',
      retryable: true,
    };
  }

  if (err.status >= 400) {
    return {
      message: sanitizeMessage(err.message),
      category: 'validation',
      retryable: false,
    };
  }

  return {
    message: sanitizeMessage(err.message),
    category: 'unknown',
    retryable: true,
  };
}

function mapGenericError(err: Error): MappedOrderError {
  const msg = err.message.toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborterror')) {
    return {
      message: 'Request timed out — the engine may be busy. Try again.',
      category: 'network',
      retryable: true,
    };
  }

  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return {
      message: 'Network error — check your connection and try again.',
      category: 'network',
      retryable: true,
    };
  }

  if (msg.includes('aborted') || msg.includes('abort')) {
    return {
      message: 'Request was cancelled. Try again if needed.',
      category: 'network',
      retryable: true,
    };
  }

  const patternMatch = matchValidationPattern(err.message);
  if (patternMatch) return patternMatch;

  return {
    message: sanitizeMessage(err.message),
    category: 'unknown',
    retryable: true,
  };
}

function matchValidationPattern(message: string): MappedOrderError | null {
  for (const { pattern, message: guidance } of VALIDATION_PATTERNS) {
    if (pattern.test(message)) {
      return { message: guidance, category: 'validation', retryable: false };
    }
  }
  return null;
}

/** Strip HTML tags and limit length to prevent injection or overflow. */
function sanitizeMessage(raw: string): string {
  const cleaned = raw.replace(/<[^>]*>/g, '').trim();
  if (cleaned.length > 200) return cleaned.slice(0, 197) + '...';
  return cleaned || 'check engine';
}
