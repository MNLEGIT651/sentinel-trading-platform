"""Rate limiting middleware for API protection."""

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter (per-IP basis).

    For production, use external service like Redis.
    Protects public endpoints from abuse.
    """

    def __init__(self, app, requests_per_minute: int = 100) -> None:
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts: dict[str, list[datetime]] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limit for internal endpoints
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        # Extract client IP
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.client.host
            if request.client
            else "unknown"
        )

        async with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=1)

            # Clean old requests for this IP
            if client_ip in self.request_counts:
                self.request_counts[client_ip] = [
                    req_time for req_time in self.request_counts[client_ip] if req_time > cutoff
                ]
                # Remove empty entries to prevent unbounded memory growth
                if not self.request_counts[client_ip]:
                    del self.request_counts[client_ip]

            # Check limit
            current_count = len(self.request_counts.get(client_ip, []))
            if current_count >= self.requests_per_minute:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {self.requests_per_minute}/min",
                )

            self.request_counts[client_ip].append(now)
            remaining = self.requests_per_minute - len(self.request_counts[client_ip])

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
