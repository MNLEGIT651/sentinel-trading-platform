"""Circuit breaker wrapper for external API calls using tenacity."""

import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)
T = TypeVar("T")


async def with_circuit_breaker(
    fn: Callable[[], Awaitable[T]],
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
) -> T:
    """Retry an async callable with exponential backoff on transient errors.

    Retries on: ConnectionError, TimeoutError, OSError.
    Raises the original exception after max_attempts.
    """

    @retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    async def _run() -> T:
        return await fn()

    return await _run()
