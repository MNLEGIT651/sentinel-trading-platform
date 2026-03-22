"""Rate limiting middleware for API protection."""

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter (per-IP basis).

    For production, use external service like Redis.
    Protects public endpoints from abuse.
    """

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts: dict[str, list[datetime]] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
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

            # Clean old requests
            self.request_counts[client_ip] = [
                req_time for req_time in self.request_counts[client_ip] if req_time > cutoff
            ]

            # Check limit
            if len(self.request_counts[client_ip]) >= self.requests_per_minute:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {self.requests_per_minute}/min",
                )

            self.request_counts[client_ip].append(now)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            self.requests_per_minute - len(self.request_counts[client_ip])
        )
        return response
