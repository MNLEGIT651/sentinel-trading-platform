import hmac
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from src.api.routes.backtest import router as backtest_router
from src.api.routes.data import router as data_router
from src.api.routes.health import router as health_router
from src.api.routes.onboarding import router as onboarding_router
from src.api.routes.portfolio import router as portfolio_router
from src.api.routes.risk import router as risk_router
from src.api.routes.signals import router as signals_router
from src.api.routes.strategies import router as strategies_router
from src.config import Settings
from src.logging_config import configure_logging
from src.middleware.rate_limit import RateLimitMiddleware
from src.middleware.tracing import CorrelationIDMiddleware
from src.telemetry import instrument_fastapi

# Paths that don't require an API key (health checks, OpenAPI docs)
_PUBLIC_PATHS = frozenset({"/health", "/docs", "/openapi.json", "/redoc"})


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Reject requests missing a valid API key.

    Preferred: ``Authorization: Bearer <key>`` (standard HTTP auth header).
    Fallback:  ``X-API-Key: <key>`` (retained for backward compatibility with
               direct API consumers not using the Next.js proxy).
    """

    def __init__(self, app, *, api_key: str) -> None:
        super().__init__(app)
        self._api_key = api_key

    async def dispatch(self, request: Request, call_next):
        if request.url.path in _PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)
        # Prefer standard Bearer token; fall back to proprietary X-API-Key header.
        provided = ""
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            provided = auth[7:]
        if not provided:
            provided = request.headers.get("X-API-Key", "")
        if not provided or not hmac.compare_digest(provided, self._api_key):
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "detail": "Invalid or missing API key"},
            )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Initialize structured logging
    log_level = os.getenv("LOG_LEVEL", "INFO")
    configure_logging(level=log_level)

    _settings.validate()

    # Log broker mode clearly at startup
    import logging as _logging

    _startup_logger = _logging.getLogger("sentinel.startup")
    _startup_logger.info(
        "Engine starting — broker_mode=%s, alpaca_base_url=%s",
        _settings.broker_mode,
        _settings.alpaca_base_url,
    )
    yield
    # Shutdown


app = FastAPI(
    title="Sentinel Engine",
    description="Quant engine for the Sentinel Trading Platform",
    version="0.1.0",
    lifespan=lifespan,
)


def _status_to_key(status_code: int) -> str:
    mapping = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "unprocessable_entity",
        429: "rate_limited",
        500: "internal_error",
        502: "bad_gateway",
        503: "service_unavailable",
    }
    return mapping.get(status_code, f"http_{status_code}")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": _status_to_key(exc.status_code), "detail": str(exc.detail)},
    )


_settings = Settings()

# Add correlation ID middleware for distributed tracing (first, so it applies to all requests)
app.add_middleware(CorrelationIDMiddleware)

# Add rate limiting middleware (before auth, to protect against brute force)
# In production with multiple instances, replace with Redis-based rate limiting
rate_limit_per_min = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))
app.add_middleware(RateLimitMiddleware, requests_per_minute=rate_limit_per_min)

# Add API key middleware for authentication
app.add_middleware(ApiKeyMiddleware, api_key=_settings.engine_api_key)

# Configure CORS
_cors_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Correlation-Id"],
)

app.include_router(health_router)
app.include_router(data_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(signals_router, prefix="/api/v1")
app.include_router(strategies_router, prefix="/api/v1")
app.include_router(backtest_router, prefix="/api/v1")
app.include_router(onboarding_router, prefix="/api/v1")

# OpenTelemetry auto-instrumentation (opt-in via OTEL_ENABLED=true)
instrument_fastapi(app)
