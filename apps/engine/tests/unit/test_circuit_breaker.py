"""Tests that external API calls fail fast with circuit breaker."""

import pytest

from src.utils.circuit_breaker import with_circuit_breaker


@pytest.mark.asyncio
async def test_circuit_breaker_raises_after_max_retries():
    """Circuit breaker should raise after configured max attempts."""
    call_count = 0

    async def flaky_call():
        nonlocal call_count
        call_count += 1
        raise ConnectionError("API down")

    with pytest.raises(ConnectionError):
        await with_circuit_breaker(flaky_call, max_attempts=3)

    assert call_count == 3, f"Expected 3 attempts, got {call_count}"


@pytest.mark.asyncio
async def test_circuit_breaker_succeeds_on_retry():
    """Circuit breaker should return result if call succeeds within attempts."""
    call_count = 0

    async def eventually_works():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ConnectionError("Temporary failure")
        return {"data": "ok"}

    result = await with_circuit_breaker(eventually_works, max_attempts=3)
    assert result == {"data": "ok"}
