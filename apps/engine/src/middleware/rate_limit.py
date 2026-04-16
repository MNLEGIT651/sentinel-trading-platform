"""Rate limiting middleware for API protection.

Uses Redis REST when configured and falls back to in-process memory in local/dev.
"""

import asyncio
import os
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class _MemoryLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self.request_counts: dict[str, list[datetime]] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def check(self, key: str) -> tuple[bool, int]:
        async with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=1)
            if key in self.request_counts:
                self.request_counts[key] = [ts for ts in self.request_counts[key] if ts > cutoff]
                if not self.request_counts[key]:
                    del self.request_counts[key]

            current_count = len(self.request_counts.get(key, []))
            if current_count >= self.requests_per_minute:
                return False, 0

            self.request_counts[key].append(now)
            remaining = self.requests_per_minute - len(self.request_counts[key])
            return True, remaining


class _RedisRestLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.requests_per_minute = requests_per_minute
        self.base_url = os.getenv("RATE_LIMIT_REDIS_REST_URL", "").rstrip("/")
        self.token = os.getenv("RATE_LIMIT_REDIS_REST_TOKEN", "")

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.token)

    async def check(self, key: str) -> tuple[bool, int] | None:
        if not self.configured:
            return None

        bucket = f"sentinel:engine:rate-limit:{key}"
        payload = [
            ["INCR", bucket],
            ["PEXPIRE", bucket, "60000", "NX"],
        ]
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.post(
                    f"{self.base_url}/pipeline",
                    headers=headers,
                    json=payload,
                )
            if response.status_code >= 400:
                return None
            data = response.json()
            count = int(data["result"][0]["result"])
            remaining = max(0, self.requests_per_minute - count)
            return count <= self.requests_per_minute, remaining
        except Exception:
            return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiter with Redis-backed distributed mode and local-memory fallback."""

    def __init__(self, app, requests_per_minute: int = 100) -> None:
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.redis = _RedisRestLimiter(requests_per_minute)
        self.memory = _MemoryLimiter(requests_per_minute)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.client.host
            if request.client
            else "unknown"
        )

        result = await self.redis.check(client_ip)
        if result is None:
            result = await self.memory.check(client_ip)

        allowed, remaining = result
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {self.requests_per_minute}/min",
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
