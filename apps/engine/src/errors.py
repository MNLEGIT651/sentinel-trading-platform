"""Error handling utilities and custom exceptions."""

import logging
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger(__name__)


class SentinelAPIError(Exception):
    """Base exception for Sentinel API errors."""

    def __init__(self, message: str, code: str, status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class ValidationError(SentinelAPIError):
    """Validation error (400)."""

    def __init__(self, message: str, code: str = "validation_error"):
        super().__init__(message, code, 400)


class AuthenticationError(SentinelAPIError):
    """Authentication error (401)."""

    def __init__(
        self, message: str = "Invalid or missing authentication", code: str = "auth_error"
    ):
        super().__init__(message, code, 401)


class ForbiddenError(SentinelAPIError):
    """Forbidden error (403)."""

    def __init__(self, message: str = "Access denied", code: str = "forbidden"):
        super().__init__(message, code, 403)


class NotFoundError(SentinelAPIError):
    """Not found error (404)."""

    def __init__(self, message: str, code: str = "not_found"):
        super().__init__(message, code, 404)


class ConflictError(SentinelAPIError):
    """Conflict error (409)."""

    def __init__(self, message: str, code: str = "conflict"):
        super().__init__(message, code, 409)


class RateLimitError(SentinelAPIError):
    """Rate limit error (429)."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        code: str = "rate_limit",
    ):
        super().__init__(message, code, 429)


class ServiceUnavailableError(SentinelAPIError):
    """Service unavailable (503)."""

    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        code: str = "service_unavailable",
    ):
        super().__init__(message, code, 503)


def to_http_exception(exc: Exception) -> HTTPException:
    """Convert SentinelAPIError to HTTPException."""
    if isinstance(exc, SentinelAPIError):
        return HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        )

    logger.error("Unhandled exception", extra={"error": str(exc), "type": type(exc).__name__})
    return HTTPException(
        status_code=500,
        detail={"error": "internal_error", "message": "An unexpected error occurred"},
    )


def safe_json_response(
    status_code: int,
    error_code: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create standardized error response JSON."""
    response = {
        "error": error_code,
        "message": message,
    }
    if data:
        response["data"] = data
    return response
