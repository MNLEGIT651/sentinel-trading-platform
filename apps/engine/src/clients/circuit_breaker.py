"""Circuit breaker for external API fault tolerance."""

from collections.abc import Callable
from datetime import datetime, timedelta
from enum import Enum
from typing import Any


class CircuitState(Enum):
    """Circuit states in circuit breaker pattern."""

    CLOSED = "closed"  # Normal, allow requests
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """Implements circuit breaker pattern for external API calls.

    Prevents cascading failures when dependent services are down:
    - CLOSED: Normal operation
    - OPEN: Reject all requests (fail fast)
    - HALF_OPEN: Allow limited requests to test recovery

    Example:
        breaker = CircuitBreaker(failure_threshold=5, timeout_seconds=60)
        try:
            data = await breaker.call(fetch_from_polygon, ticker)
        except CircuitBreakerOpenError:
            data = load_from_cache(ticker)
    """

    def __init__(
        self,
        name: str = "circuit_breaker",
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        success_threshold: int = 2,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.success_threshold = success_threshold

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: datetime | None = None

    async def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """Execute function with circuit breaker protection."""
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                raise CircuitBreakerOpenError(
                    f"{self.name}: Circuit breaker OPEN, reopens in {self._time_until_reset():.0f}s"
                )

        try:
            result = await func(*args, **kwargs)
            self._record_success()
            return result
        except Exception:
            self._record_failure()
            raise

    def _record_success(self) -> None:
        """Record successful call."""
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED

    def _record_failure(self) -> None:
        """Record failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def _should_attempt_reset(self) -> bool:
        """Check if ready to attempt recovery."""
        if not self.last_failure_time:
            return True
        elapsed = datetime.now() - self.last_failure_time
        return elapsed >= timedelta(seconds=self.timeout_seconds)

    def _time_until_reset(self) -> float:
        """Seconds until circuit will attempt reset."""
        if not self.last_failure_time:
            return 0
        elapsed = (datetime.now() - self.last_failure_time).total_seconds()
        return max(0, self.timeout_seconds - elapsed)

    def is_open(self) -> bool:
        """Check if circuit is open (requests will be rejected)."""
        return self.state == CircuitState.OPEN

    def get_state(self) -> str:
        """Get current state name."""
        return self.state.value


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open."""

    pass


CircuitBreakerOpen = CircuitBreakerOpenError
