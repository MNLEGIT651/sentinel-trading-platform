"""Request correlation ID tracing middleware.

Adds X-Request-ID header to all requests for distributed tracing.
Allows correlating logs across engine, agents, and web services.
"""

import logging
import uuid
from collections.abc import Callable
from contextvars import ContextVar

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Context var for accessing request ID in other parts of app
request_id_context: ContextVar[str] = ContextVar("request_id", default="")


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Add X-Request-ID header to all requests for tracing.

    If client provides X-Request-ID header, use it.
    Otherwise, generate a UUID.
    Response includes the same X-Request-ID for correlation.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Extract or generate request ID — accept both x-correlation-id (sent
        # by the web/agents proxy) and X-Request-ID for backwards compat.
        request_id = (
            request.headers.get("x-correlation-id")
            or request.headers.get("X-Request-ID")
            or str(uuid.uuid4())
        )
        request_id_context.set(request_id)

        # Add to logging context
        logging.LogRecord.request_id = request_id

        # Attach correlation_id to the active OTel span (if tracing is enabled)
        try:
            from opentelemetry import trace

            span = trace.get_current_span()
            if span.is_recording():
                span.set_attribute("correlation_id", request_id)
        except Exception:
            pass

        response = await call_next(request)

        # Include request ID in response headers (both names for interop)
        response.headers["X-Request-ID"] = request_id
        response.headers["x-correlation-id"] = request_id

        return response


class CorrelationIDFilter(logging.Filter):
    """Log filter that adds request_id to all log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context.get("")
        return True


def setup_correlation_logging(logger: logging.Logger) -> None:
    """Configure logger to include request IDs."""
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s"
    )

    filter_obj = CorrelationIDFilter()

    for handler in logger.handlers:
        handler.setFormatter(formatter)
        handler.addFilter(filter_obj)
