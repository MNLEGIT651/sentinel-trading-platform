"""Middleware that records request latency and status for SLO metrics."""

import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.metrics.collector import get_metrics_collector


class MetricsMiddleware(BaseHTTPMiddleware):
    """Capture request duration and status code into the metrics collector."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        get_metrics_collector().record(
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        return response
