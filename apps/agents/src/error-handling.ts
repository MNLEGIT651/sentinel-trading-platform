/**
 * Error handling utilities for agents service.
 * Provides standardized error responses and retry logic.
 */

/**
 * Retry decorator with exponential backoff.
 * Useful for transient failures.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Timeout wrapper for async operations.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

/**
 * Standard error response format.
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Create standardized error response.
 */
export function createErrorResponse(
  error: unknown,
  code: string,
  requestId?: string,
): ErrorResponse {
  const message = error instanceof Error ? error.message : String(error);

  return {
    error: code,
    message,
    code,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
}

/**
 * Circuit breaker state.
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Failing, reject requests
  HALF_OPEN = 'half_open', // Testing recovery
}

/**
 * Simple in-memory circuit breaker.
 * For production, use Redis-backed version.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,
    private readonly timeoutMs: number = 60_000,
    private readonly successThreshold: number = 2,
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker OPEN for ${this.name}. ` +
            `Reopens in ${this.timeUntilReset().toFixed(0)}s`,
        );
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.timeoutMs;
  }

  private timeUntilReset(): number {
    if (!this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, (this.timeoutMs - elapsed) / 1000);
  }

  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }
}
