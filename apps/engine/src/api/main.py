from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.limiter import limiter
from src.api.routes.backtest import router as backtest_router
from src.api.routes.data import router as data_router
from src.api.routes.health import router as health_router
from src.api.routes.portfolio import router as portfolio_router
from src.api.routes.risk import router as risk_router
from src.api.routes.strategies import router as strategies_router
from src.config import Settings

_settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    _settings.validate()
    yield
    # Shutdown


_is_production = _settings.environment == "production"

app = FastAPI(
    title="Sentinel Engine API",
    version="1.0.0",
    description="Quantitative trading engine — strategies, signals, backtesting, risk",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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


app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(data_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(strategies_router, prefix="/api/v1")
app.include_router(backtest_router, prefix="/api/v1")
