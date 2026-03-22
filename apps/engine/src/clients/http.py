"""HTTP client factory with timeouts and circuit breaker support."""

import logging
from functools import lru_cache

import httpx

from src.clients.circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)


class HTTPClientConfig:
    """Configuration for HTTP client."""

    TIMEOUT_TOTAL = 10.0  # Total request timeout
    TIMEOUT_CONNECT = 5.0  # Connection timeout
    TIMEOUT_READ = 8.0  # Read timeout
    MAX_CONNECTIONS = 10
    MAX_KEEPALIVE = 5


@lru_cache(maxsize=1)
def get_http_client() -> httpx.AsyncClient:
    """Get cached HTTP client with timeout and connection pool settings.

    Returns the same instance for all requests to reuse connection pools
    and reduce overhead. Safe to use across async functions.
    """
    return httpx.AsyncClient(
        timeout=httpx.Timeout(
            timeout=HTTPClientConfig.TIMEOUT_TOTAL,
            connect=HTTPClientConfig.TIMEOUT_CONNECT,
            read=HTTPClientConfig.TIMEOUT_READ,
        ),
        limits=httpx.Limits(
            max_connections=HTTPClientConfig.MAX_CONNECTIONS,
            max_keepalive_connections=HTTPClientConfig.MAX_KEEPALIVE,
        ),
        # Retry transient errors automatically
        transport=httpx.AsyncHTTPTransport(
            retries=1,
        ),
    )


@lru_cache(maxsize=1)
def get_polygon_circuit_breaker() -> CircuitBreaker:
    """Get cached circuit breaker for Polygon.io API.

    Opens after 5 consecutive failures, reopens after 60 seconds.
    """
    return CircuitBreaker(
        name="polygon_api",
        failure_threshold=5,
        timeout_seconds=60,
        success_threshold=2,
    )


@lru_cache(maxsize=1)
def get_alpaca_circuit_breaker() -> CircuitBreaker:
    """Get cached circuit breaker for Alpaca API."""
    return CircuitBreaker(
        name="alpaca_api",
        failure_threshold=5,
        timeout_seconds=60,
        success_threshold=2,
    )


@lru_cache(maxsize=1)
def get_supabase_circuit_breaker() -> CircuitBreaker:
    """Get cached circuit breaker for Supabase."""
    return CircuitBreaker(
        name="supabase_db",
        failure_threshold=10,
        timeout_seconds=30,
        success_threshold=3,
    )


async def close_http_client() -> None:
    """Close HTTP client and cleanup resources.

    Call this during application shutdown.
    """
    client = get_http_client()
    await client.aclose()
    logger.info("HTTP client closed")
