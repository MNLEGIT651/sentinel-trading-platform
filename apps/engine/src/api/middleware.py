"""Request correlation ID middleware for distributed tracing."""

import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

CORRELATION_ID_HEADER = "X-Correlation-ID"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Injects a correlation ID into every request/response for tracing."""

    async def dispatch(self, request: Request, call_next) -> Response:
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        logger.info(
            "request_started",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else "unknown",
            },
        )

        response = await call_next(request)
        response.headers[CORRELATION_ID_HEADER] = correlation_id

        logger.info(
            "request_completed",
            extra={
                "correlation_id": correlation_id,
                "status_code": response.status_code,
            },
        )
        return response
