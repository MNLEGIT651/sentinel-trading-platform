from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.data import router as data_router
from src.api.routes.health import router as health_router
from src.api.routes.portfolio import router as portfolio_router
from src.api.routes.backtest import router as backtest_router
from src.api.routes.risk import router as risk_router
from src.api.routes.strategies import router as strategies_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="Sentinel Engine",
    description="Quant engine for the Sentinel Trading Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
