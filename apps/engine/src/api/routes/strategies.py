"""Strategy API routes.

Endpoints for listing strategies, running signal scans,
and managing strategy configurations.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter

from src.strategies.registry import list_strategies, FAMILY_MAP


router = APIRouter(prefix="/strategies", tags=["strategies"])


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------

class StrategyInfo(BaseModel):
    """Strategy metadata."""

    name: str
    family: str
    description: str
    default_params: dict


class StrategyListResponse(BaseModel):
    """Response for listing available strategies."""

    strategies: list[StrategyInfo]
    families: list[str]
    total: int


class SignalOut(BaseModel):
    """API representation of a trading signal."""

    ticker: str
    direction: str
    strength: float
    strategy_name: str
    reason: str
    metadata: dict = Field(default_factory=dict)


class ScanResponse(BaseModel):
    """Response for a strategy scan run."""

    signals: list[SignalOut]
    total_signals: int
    tickers_scanned: int
    strategies_run: int
    errors: list[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=StrategyListResponse)
async def get_strategies() -> StrategyListResponse:
    """List all available strategies and families."""
    strategies_data = list_strategies()
    infos = [
        StrategyInfo(
            name=info["name"],
            family=info["family"],
            description=info["description"],
            default_params=info["default_params"],
        )
        for info in strategies_data.values()
    ]
    return StrategyListResponse(
        strategies=infos,
        families=sorted(FAMILY_MAP.keys()),
        total=len(infos),
    )


@router.get("/families/{family}", response_model=StrategyListResponse)
async def get_family_strategies(family: str) -> StrategyListResponse:
    """List strategies in a specific family."""
    if family not in FAMILY_MAP:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown family: {family}")

    strategies_data = list_strategies()
    family_names = FAMILY_MAP[family]
    infos = [
        StrategyInfo(
            name=info["name"],
            family=info["family"],
            description=info["description"],
            default_params=info["default_params"],
        )
        for name, info in strategies_data.items()
        if name in family_names
    ]
    return StrategyListResponse(
        strategies=infos,
        families=[family],
        total=len(infos),
    )


@router.get("/{strategy_name}", response_model=StrategyInfo)
async def get_strategy_detail(strategy_name: str) -> StrategyInfo:
    """Get details for a specific strategy."""
    strategies_data = list_strategies()
    if strategy_name not in strategies_data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown strategy: {strategy_name}")

    info = strategies_data[strategy_name]
    return StrategyInfo(
        name=info["name"],
        family=info["family"],
        description=info["description"],
        default_params=info["default_params"],
    )
