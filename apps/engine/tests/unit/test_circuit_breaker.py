"""Tests for the circuit breaker implementation."""

import pytest

from src.clients.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpen,
    CircuitBreakerOpenError,
    CircuitState,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def succeed(value="ok"):
    """Simple coroutine that succeeds."""
    return value


async def fail(message="upstream error"):
    """Simple coroutine that always raises."""
    raise RuntimeError(message)


# ---------------------------------------------------------------------------
# Initial state
# ---------------------------------------------------------------------------


class TestCircuitBreakerInitialState:
    def test_starts_closed(self):
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED
        assert cb.is_open() is False

    def test_get_state_returns_string(self):
        cb = CircuitBreaker()
        assert cb.get_state() == "closed"

    def test_failure_count_starts_at_zero(self):
        cb = CircuitBreaker()
        assert cb.failure_count == 0

    def test_last_failure_time_starts_none(self):
        cb = CircuitBreaker()
        assert cb.last_failure_time is None

    def test_custom_name_stored(self):
        cb = CircuitBreaker(name="polygon-api")
        assert cb.name == "polygon-api"


# ---------------------------------------------------------------------------
# Closed state — normal operation
# ---------------------------------------------------------------------------


class TestCircuitBreakerClosed:
    @pytest.mark.asyncio
    async def test_successful_call_returns_result(self):
        cb = CircuitBreaker()
        result = await cb.call(succeed, "hello")
        assert result == "hello"

    @pytest.mark.asyncio
    async def test_successful_calls_do_not_open_circuit(self):
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(10):
            await cb.call(succeed)
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_failed_call_propagates_exception(self):
        cb = CircuitBreaker()
        with pytest.raises(RuntimeError, match="upstream error"):
            await cb.call(fail, "upstream error")

    @pytest.mark.asyncio
    async def test_failed_call_increments_failure_count(self):
        cb = CircuitBreaker(failure_threshold=5)
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.failure_count == 1

    @pytest.mark.asyncio
    async def test_records_last_failure_time(self):
        cb = CircuitBreaker(failure_threshold=5)
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.last_failure_time is not None


# ---------------------------------------------------------------------------
# Opening the circuit
# ---------------------------------------------------------------------------


class TestCircuitBreakerOpening:
    @pytest.mark.asyncio
    async def test_circuit_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=3)
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(fail)
        assert cb.state == CircuitState.OPEN
        assert cb.is_open() is True

    @pytest.mark.asyncio
    async def test_open_state_rejects_immediately(self):
        cb = CircuitBreaker(failure_threshold=2)
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await cb.call(fail)

        # Circuit is now OPEN — next call should raise CircuitBreakerOpenError
        with pytest.raises(CircuitBreakerOpenError):
            await cb.call(succeed)

    @pytest.mark.asyncio
    async def test_open_error_message_contains_name(self):
        cb = CircuitBreaker(name="test-breaker", failure_threshold=1)
        with pytest.raises(RuntimeError):
            await cb.call(fail)

        with pytest.raises(CircuitBreakerOpenError, match="test-breaker"):
            await cb.call(succeed)

    @pytest.mark.asyncio
    async def test_get_state_returns_open_string(self):
        cb = CircuitBreaker(failure_threshold=1)
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.get_state() == "open"

    @pytest.mark.asyncio
    async def test_circuit_breaker_open_alias(self):
        """CircuitBreakerOpen should be the same class as CircuitBreakerOpenError."""
        assert CircuitBreakerOpen is CircuitBreakerOpenError


# ---------------------------------------------------------------------------
# Half-open state (recovery testing)
# ---------------------------------------------------------------------------


class TestCircuitBreakerHalfOpen:
    @pytest.mark.asyncio
    async def test_transitions_to_half_open_after_timeout(self):
        cb = CircuitBreaker(failure_threshold=1, timeout_seconds=0)
        with pytest.raises(RuntimeError):
            await cb.call(fail)

        # timeout_seconds=0 means it should be ready to reset immediately
        # Calling again should move to HALF_OPEN
        await cb.call(succeed)
        # After one success in HALF_OPEN, success_count = 1
        # success_threshold default = 2, so still HALF_OPEN
        assert cb.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_closes_after_sufficient_successes_in_half_open(self):
        cb = CircuitBreaker(failure_threshold=1, timeout_seconds=0, success_threshold=2)
        with pytest.raises(RuntimeError):
            await cb.call(fail)

        # Two successful calls in HALF_OPEN should close the circuit
        await cb.call(succeed)
        await cb.call(succeed)
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_re_opens_on_failure_in_half_open(self):
        cb = CircuitBreaker(failure_threshold=1, timeout_seconds=0, success_threshold=3)
        with pytest.raises(RuntimeError):
            await cb.call(fail)

        # One success to enter HALF_OPEN
        await cb.call(succeed)
        assert cb.state == CircuitState.HALF_OPEN

        # Another failure in HALF_OPEN should trip back to OPEN
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_get_state_returns_half_open_string(self):
        cb = CircuitBreaker(failure_threshold=1, timeout_seconds=0)
        with pytest.raises(RuntimeError):
            await cb.call(fail)
        await cb.call(succeed)
        assert cb.get_state() == "half_open"


# ---------------------------------------------------------------------------
# Success resets failure count
# ---------------------------------------------------------------------------


class TestCircuitBreakerSuccessReset:
    @pytest.mark.asyncio
    async def test_success_resets_failure_count(self):
        cb = CircuitBreaker(failure_threshold=5)
        # Accumulate some failures
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await cb.call(fail)
        assert cb.failure_count == 3

        # A success should reset the failure count
        await cb.call(succeed)
        assert cb.failure_count == 0

    @pytest.mark.asyncio
    async def test_circuit_stays_closed_after_success_following_failures(self):
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(4):
            with pytest.raises(RuntimeError):
                await cb.call(fail)
        await cb.call(succeed)
        assert cb.state == CircuitState.CLOSED


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------


class TestCircuitBreakerParameters:
    @pytest.mark.asyncio
    async def test_failure_threshold_respected(self):
        cb = CircuitBreaker(failure_threshold=10)
        for _ in range(9):
            with pytest.raises(RuntimeError):
                await cb.call(fail)
        assert cb.state == CircuitState.CLOSED

        with pytest.raises(RuntimeError):
            await cb.call(fail)
        assert cb.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_should_not_reset_before_timeout(self):
        """Circuit should remain OPEN when timeout hasn't elapsed."""
        # timeout_seconds=3600 — won't expire during this test
        cb = CircuitBreaker(failure_threshold=1, timeout_seconds=3600)
        with pytest.raises(RuntimeError):
            await cb.call(fail)

        with pytest.raises(CircuitBreakerOpenError):
            await cb.call(succeed)

        assert cb.state == CircuitState.OPEN
