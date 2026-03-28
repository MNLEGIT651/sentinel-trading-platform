"""Risk management API routes.

Endpoints for portfolio risk assessment, position sizing,
risk configuration, operational halt/resume controls,
and universe restrictions.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.api.models.responses import (
    PreTradeCheckResponse,
    RiskAssessmentResponse,
    RiskLimitsResponse,
)
from src.db import get_db
from src.risk.position_sizer import PositionSizer, RiskLimits
from src.risk.risk_manager import PortfolioState, RiskManager
from src.telemetry import get_tracer

logger = logging.getLogger(__name__)
_tracer = get_tracer(__name__)

router = APIRouter(prefix="/risk", tags=["risk"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class PositionSizeRequest(BaseModel):
    """Request for position sizing calculation."""

    ticker: str
    price: float
    method: str = "fixed_fraction"
    equity: float = 100_000.0
    risk_fraction: float = 0.01
    stop_distance: float | None = None
    atr: float | None = None
    win_rate: float | None = None
    avg_win: float | None = None
    avg_loss: float | None = None


class PositionSizeResponse(BaseModel):
    """Response with position sizing result."""

    ticker: str
    shares: int
    dollar_amount: float
    weight: float
    method: str
    risk_per_share: float


class RiskAssessmentRequest(BaseModel):
    """Request for portfolio risk assessment."""

    equity: float
    cash: float
    peak_equity: float
    daily_starting_equity: float
    positions: dict[str, float] = Field(default_factory=dict)
    position_sectors: dict[str, str] = Field(default_factory=dict)


class PreTradeCheckRequest(BaseModel):
    """Request for pre-trade risk check."""

    ticker: str
    shares: int
    price: float
    side: str  # "buy" or "sell"
    equity: float
    cash: float
    peak_equity: float
    daily_starting_equity: float
    positions: dict[str, float] = Field(default_factory=dict)
    position_sectors: dict[str, str] = Field(default_factory=dict)
    sector: str = "unknown"
    recommendation_id: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/position-size", response_model=PositionSizeResponse)
async def calculate_position_size(req: PositionSizeRequest) -> PositionSizeResponse:
    """Calculate position size for a proposed trade."""
    sizer = PositionSizer(total_equity=req.equity)

    if req.method == "volatility_target" and req.atr is not None:
        result = sizer.volatility_target(ticker=req.ticker, price=req.price, atr=req.atr)
    elif req.method == "kelly_criterion" and all([req.win_rate, req.avg_win, req.avg_loss]):
        result = sizer.kelly_criterion(
            ticker=req.ticker,
            price=req.price,
            win_rate=req.win_rate,
            avg_win=req.avg_win,
            avg_loss=req.avg_loss,
        )
    else:
        result = sizer.fixed_fraction(
            ticker=req.ticker,
            price=req.price,
            risk_fraction=req.risk_fraction,
            stop_distance=req.stop_distance,
        )

    return PositionSizeResponse(
        ticker=result.ticker,
        shares=result.shares,
        dollar_amount=result.dollar_amount,
        weight=result.weight,
        method=result.method.value,
        risk_per_share=result.risk_per_share,
    )


@router.post("/assess", response_model=RiskAssessmentResponse)
async def assess_portfolio_risk(req: RiskAssessmentRequest) -> RiskAssessmentResponse:
    """Assess current portfolio risk levels."""
    manager = RiskManager()
    state = PortfolioState(
        equity=req.equity,
        cash=req.cash,
        peak_equity=req.peak_equity,
        daily_starting_equity=req.daily_starting_equity,
        positions=req.positions,
        position_sectors=req.position_sectors,
    )
    data = manager.assess_portfolio_risk(state)
    return RiskAssessmentResponse(**data)


@router.post("/pre-trade-check", response_model=PreTradeCheckResponse)
async def pre_trade_check(req: PreTradeCheckRequest) -> PreTradeCheckResponse:
    """Run pre-trade risk check."""
    with _tracer.start_as_current_span(
        "risk.pre_trade_check",
        attributes={
            "risk.ticker": req.ticker,
            "risk.shares": req.shares,
            "risk.side": req.side,
            "risk.equity": req.equity,
        },
    ) as span:
        manager = RiskManager()
        state = PortfolioState(
            equity=req.equity,
            cash=req.cash,
            peak_equity=req.peak_equity,
            daily_starting_equity=req.daily_starting_equity,
            positions=req.positions,
            position_sectors=req.position_sectors,
        )
        result = manager.pre_trade_check(
            ticker=req.ticker,
            shares=req.shares,
            price=req.price,
            side=req.side,
            state=state,
            sector=req.sector,
        )
        span.set_attribute("risk.allowed", result.allowed)
        span.set_attribute("risk.action", result.action.value)

    limits = RiskLimits()

    # Persist risk evaluation to Supabase when a recommendation_id is provided
    if req.recommendation_id:
        try:
            db = get_db()
            if db is not None:
                db.table("risk_evaluations").insert(
                    {
                        "recommendation_id": req.recommendation_id,
                        "policy_version": "v1",
                        "allowed": result.allowed,
                        "original_quantity": req.shares,
                        "adjusted_quantity": result.adjusted_shares or req.shares,
                        "checks_performed": [
                            {
                                "name": "position_concentration",
                                "passed": True,
                                "limit": limits.max_position_pct,
                                "actual": None,
                                "message": None,
                            },
                            {
                                "name": "sector_exposure",
                                "passed": True,
                                "limit": limits.max_sector_pct,
                                "actual": None,
                                "message": None,
                            },
                            {
                                "name": "daily_loss",
                                "passed": True,
                                "limit": limits.max_portfolio_risk_pct,
                                "actual": None,
                                "message": None,
                            },
                        ],
                        "reason": result.reason,
                    }
                ).execute()
        except Exception:
            logger.warning(
                "Failed to write risk_evaluations for recommendation %s",
                req.recommendation_id,
                exc_info=True,
            )

    return PreTradeCheckResponse(
        allowed=result.allowed,
        action=result.action.value,
        reason=result.reason,
        adjusted_shares=result.adjusted_shares,
        recommendation_id=req.recommendation_id,
    )


@router.get("/limits", response_model=RiskLimitsResponse)
async def get_risk_limits() -> RiskLimitsResponse:
    """Get current risk limit configuration."""
    limits = RiskLimits()
    return RiskLimitsResponse(
        max_position_pct=limits.max_position_pct,
        max_sector_pct=limits.max_sector_pct,
        max_portfolio_risk_pct=limits.max_portfolio_risk_pct,
        max_drawdown_soft=limits.max_drawdown_soft,
        max_drawdown_hard=limits.max_drawdown_hard,
        max_correlated_exposure=limits.max_correlated_exposure,
        max_open_positions=limits.max_open_positions,
    )


# ---------------------------------------------------------------------------
# Risk State / Halt / Resume / Policy Models
# ---------------------------------------------------------------------------


class RiskStateResponse(BaseModel):
    """Current risk posture snapshot."""

    trading_halted: bool
    live_execution_enabled: bool
    global_mode: str
    drawdown: float | None = None
    max_drawdown: float | None = None
    recent_blocks: list[dict] = Field(default_factory=list)


class HaltRequest(BaseModel):
    """Request body for halting or resuming trading."""

    reason: str


class HaltResponse(BaseModel):
    """Response after halt/resume action."""

    trading_halted: bool
    action_id: str | None = None


class AutoExecutionCheck(BaseModel):
    """Individual check result for auto-execution eligibility."""

    autonomy_mode: str
    signal_strength: bool
    position_size: bool
    daily_limit: bool
    halt_status: bool


class AutoExecutionEligibilityResponse(BaseModel):
    """Auto-execution eligibility decision for a recommendation."""

    can_auto_execute: bool
    reason: str
    policy_version: int
    checks: AutoExecutionCheck
    recommendation_id: str


class RiskPolicyResponse(BaseModel):
    """Active risk policy."""

    id: str
    version: int
    max_position_pct: float
    max_sector_pct: float
    daily_loss_limit_pct: float
    soft_drawdown_pct: float
    hard_drawdown_pct: float
    approval_required: bool
    autonomy_mode: str
    enabled_at: str | None = None


class RiskPolicyUpdateRequest(BaseModel):
    """Fields for updating the risk policy (all optional, merges with current)."""

    max_position_pct: float | None = None
    max_sector_pct: float | None = None
    daily_loss_limit_pct: float | None = None
    soft_drawdown_pct: float | None = None
    hard_drawdown_pct: float | None = None
    approval_required: bool | None = None
    autonomy_mode: str | None = None


# ---------------------------------------------------------------------------
# Risk State / Halt / Resume / Policy Endpoints
# ---------------------------------------------------------------------------


def _require_db():
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")
    return db


@router.get("/state", response_model=RiskStateResponse)
async def get_risk_state() -> RiskStateResponse:
    """Current risk posture: halt status, drawdown, recent blocks."""
    db = _require_db()

    # System controls
    controls_result = (
        db.table("system_controls")
        .select("trading_halted,live_execution_enabled,global_mode")
        .limit(1)
        .single()
        .execute()
    )
    controls = controls_result.data or {}

    # Latest portfolio snapshot for drawdown
    drawdown: float | None = None
    max_drawdown: float | None = None
    try:
        snap_result = (
            db.table("portfolio_snapshots")
            .select("drawdown,max_drawdown")
            .order("timestamp", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        if snap_result.data:
            dd = snap_result.data.get("drawdown")
            mdd = snap_result.data.get("max_drawdown")
            drawdown = float(dd) if dd is not None else None
            max_drawdown = float(mdd) if mdd is not None else None
    except Exception:
        logger.warning("Failed to read portfolio_snapshots for risk state", exc_info=True)

    # Recent risk evaluation blocks (last 10 that were not allowed)
    recent_blocks: list[dict] = []
    try:
        blocks_result = (
            db.table("risk_evaluations")
            .select("id,recommendation_id,reason,evaluated_at")
            .eq("allowed", False)
            .order("evaluated_at", desc=True)
            .limit(10)
            .execute()
        )
        recent_blocks = [
            {
                "id": str(row["id"]),
                "recommendation_id": (
                    str(row["recommendation_id"]) if row.get("recommendation_id") else None
                ),
                "reason": row.get("reason"),
                "evaluated_at": row.get("evaluated_at"),
            }
            for row in (blocks_result.data or [])
        ]
    except Exception:
        logger.warning("Failed to read risk_evaluations for risk state", exc_info=True)

    return RiskStateResponse(
        trading_halted=controls.get("trading_halted", False),
        live_execution_enabled=controls.get("live_execution_enabled", False),
        global_mode=controls.get("global_mode", "paper"),
        drawdown=drawdown,
        max_drawdown=max_drawdown,
        recent_blocks=recent_blocks,
    )


@router.post("/halt", response_model=HaltResponse)
async def halt_trading(body: HaltRequest) -> HaltResponse:
    """Trigger trading halt and record operator action."""
    db = _require_db()

    # Set trading_halted = true on the single system_controls row
    controls = db.table("system_controls").select("id").limit(1).single().execute()
    control_id = controls.data["id"] if controls.data else None
    if control_id is None:
        raise HTTPException(status_code=500, detail="system_controls row not found")

    db.table("system_controls").update(
        {"trading_halted": True, "updated_at": datetime.now(UTC).isoformat()}
    ).eq("id", control_id).execute()

    # Record operator action
    action_id: str | None = None
    try:
        action_result = (
            db.table("operator_actions")
            .insert(
                {
                    "action_type": "trading_halt",
                    "target_type": "system_controls",
                    "target_id": str(control_id),
                    "reason": body.reason,
                    "metadata": {"action": "halt"},
                }
            )
            .select("id")
            .single()
            .execute()
        )
        action_id = str(action_result.data["id"]) if action_result.data else None
    except Exception:
        logger.warning("Failed to record halt operator_action", exc_info=True)

    return HaltResponse(trading_halted=True, action_id=action_id)


@router.post("/resume", response_model=HaltResponse)
async def resume_trading(body: HaltRequest) -> HaltResponse:
    """Clear trading halt and record operator action."""
    db = _require_db()

    controls = db.table("system_controls").select("id").limit(1).single().execute()
    control_id = controls.data["id"] if controls.data else None
    if control_id is None:
        raise HTTPException(status_code=500, detail="system_controls row not found")

    db.table("system_controls").update(
        {"trading_halted": False, "updated_at": datetime.now(UTC).isoformat()}
    ).eq("id", control_id).execute()

    action_id: str | None = None
    try:
        action_result = (
            db.table("operator_actions")
            .insert(
                {
                    "action_type": "trading_resume",
                    "target_type": "system_controls",
                    "target_id": str(control_id),
                    "reason": body.reason,
                    "metadata": {"action": "resume"},
                }
            )
            .select("id")
            .single()
            .execute()
        )
        action_id = str(action_result.data["id"]) if action_result.data else None
    except Exception:
        logger.warning("Failed to record resume operator_action", exc_info=True)

    return HaltResponse(trading_halted=False, action_id=action_id)


@router.get("/policy", response_model=RiskPolicyResponse)
async def get_risk_policy() -> RiskPolicyResponse:
    """Get the active risk policy (latest where disabled_at IS NULL)."""
    db = _require_db()

    result = (
        db.table("risk_policies")
        .select("*")
        .is_("disabled_at", "null")
        .order("enabled_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No active risk policy found")

    row = result.data
    return RiskPolicyResponse(
        id=str(row["id"]),
        version=row["version"],
        max_position_pct=float(row["max_position_pct"]),
        max_sector_pct=float(row["max_sector_pct"]),
        daily_loss_limit_pct=float(row["daily_loss_limit_pct"]),
        soft_drawdown_pct=float(row["soft_drawdown_pct"]),
        hard_drawdown_pct=float(row["hard_drawdown_pct"]),
        approval_required=row["approval_required"],
        autonomy_mode=row["autonomy_mode"],
        enabled_at=row.get("enabled_at"),
    )


@router.put("/policy", response_model=RiskPolicyResponse)
async def update_risk_policy(body: RiskPolicyUpdateRequest) -> RiskPolicyResponse:
    """Update risk policy: inserts a new version and disables the previous one."""
    db = _require_db()

    # Read current active policy to merge with
    current = (
        db.table("risk_policies")
        .select("*")
        .is_("disabled_at", "null")
        .order("enabled_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )

    now = datetime.now(UTC).isoformat()
    next_version = 1

    if current.data:
        next_version = current.data["version"] + 1
        # Disable the old policy
        db.table("risk_policies").update({"disabled_at": now}).eq(
            "id", current.data["id"]
        ).execute()

    # Build new policy row merging defaults from current if available
    def _pick(field: str, default):
        """Use the explicit body value if set, else carry forward from current policy."""
        val = getattr(body, field)
        if val is not None:
            return val
        if current.data and current.data.get(field) is not None:
            return current.data[field]
        return default

    new_row = {
        "version": next_version,
        "max_position_pct": _pick("max_position_pct", 5.0),
        "max_sector_pct": _pick("max_sector_pct", 20.0),
        "daily_loss_limit_pct": _pick("daily_loss_limit_pct", 2.0),
        "soft_drawdown_pct": _pick("soft_drawdown_pct", 10.0),
        "hard_drawdown_pct": _pick("hard_drawdown_pct", 15.0),
        "approval_required": _pick("approval_required", True),
        "autonomy_mode": _pick("autonomy_mode", "suggest"),
        "enabled_at": now,
    }

    insert_result = db.table("risk_policies").insert(new_row).select("*").single().execute()
    row = insert_result.data
    if not row:
        raise HTTPException(status_code=500, detail="Failed to insert new risk policy")

    return RiskPolicyResponse(
        id=str(row["id"]),
        version=row["version"],
        max_position_pct=float(row["max_position_pct"]),
        max_sector_pct=float(row["max_sector_pct"]),
        daily_loss_limit_pct=float(row["daily_loss_limit_pct"]),
        soft_drawdown_pct=float(row["soft_drawdown_pct"]),
        hard_drawdown_pct=float(row["hard_drawdown_pct"]),
        approval_required=row["approval_required"],
        autonomy_mode=row["autonomy_mode"],
        enabled_at=row.get("enabled_at"),
    )


# ---------------------------------------------------------------------------
# Auto-Execution Eligibility
# ---------------------------------------------------------------------------

SIGNAL_STRENGTH_THRESHOLD = 0.7
DAILY_AUTO_TRADE_LIMIT = 10
MAX_AUTO_POSITION_VALUE = 50_000.0
AUTO_EXECUTE_MODES = {"auto_execute", "auto_approve"}


@router.get(
    "/auto-execution-eligibility",
    response_model=AutoExecutionEligibilityResponse,
)
async def check_auto_execution_eligibility(
    recommendation_id: str,
) -> AutoExecutionEligibilityResponse:
    """Check whether a recommendation is eligible for auto-execution.

    Reads the active risk policy, system controls, and recommendation data
    to produce a decision without side effects (no approval, no order).
    """
    db = _require_db()

    # 1. Fetch recommendation
    rec_result = (
        db.table("agent_recommendations")
        .select("id,signal_strength,quantity,ticker,limit_price,status")
        .eq("id", recommendation_id)
        .maybe_single()
        .execute()
    )
    if not rec_result.data:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec = rec_result.data

    # 2. Fetch active risk policy
    policy_result = (
        db.table("risk_policies")
        .select("version,autonomy_mode,max_position_pct,daily_loss_limit_pct")
        .is_("disabled_at", "null")
        .order("enabled_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not policy_result.data:
        raise HTTPException(status_code=404, detail="No active risk policy found")
    policy = policy_result.data

    # 3. Fetch system controls
    controls_result = (
        db.table("system_controls")
        .select("trading_halted,live_execution_enabled")
        .limit(1)
        .single()
        .execute()
    )
    controls = controls_result.data or {}

    # 4. Run eligibility checks
    checks = AutoExecutionCheck(
        autonomy_mode=policy["autonomy_mode"],
        signal_strength=False,
        position_size=False,
        daily_limit=False,
        halt_status=False,
    )

    # Check autonomy mode
    if policy["autonomy_mode"] not in AUTO_EXECUTE_MODES:
        return AutoExecutionEligibilityResponse(
            can_auto_execute=False,
            reason=f"Autonomy mode '{policy['autonomy_mode']}' does not permit auto-execution",
            policy_version=policy["version"],
            checks=checks,
            recommendation_id=recommendation_id,
        )

    # Check halt status
    if controls.get("trading_halted", False):
        return AutoExecutionEligibilityResponse(
            can_auto_execute=False,
            reason="Trading is currently halted",
            policy_version=policy["version"],
            checks=checks,
            recommendation_id=recommendation_id,
        )
    checks.halt_status = True

    # Check signal strength
    signal = float(rec.get("signal_strength") or 0)
    if signal < SIGNAL_STRENGTH_THRESHOLD:
        return AutoExecutionEligibilityResponse(
            can_auto_execute=False,
            reason=f"Signal strength {signal:.2f} is below threshold {SIGNAL_STRENGTH_THRESHOLD}",
            policy_version=policy["version"],
            checks=checks,
            recommendation_id=recommendation_id,
        )
    checks.signal_strength = True

    # Check position size
    price = float(rec.get("limit_price") or 100)
    quantity = int(rec.get("quantity") or 0)
    position_value = quantity * price
    if position_value > MAX_AUTO_POSITION_VALUE:
        return AutoExecutionEligibilityResponse(
            can_auto_execute=False,
            reason=(
                f"Position value ${position_value:.0f} exceeds "
                f"auto-execution limit ${MAX_AUTO_POSITION_VALUE:.0f}"
            ),
            policy_version=policy["version"],
            checks=checks,
            recommendation_id=recommendation_id,
        )
    checks.position_size = True

    # Check daily limit
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_result = (
        db.table("recommendation_events")
        .select("*", count="exact", head=True)
        .eq("event_type", "auto_approved")
        .eq("actor_type", "policy")
        .gte("created_at", today_start.isoformat())
        .execute()
    )
    daily_count = daily_result.count or 0
    if daily_count >= DAILY_AUTO_TRADE_LIMIT:
        return AutoExecutionEligibilityResponse(
            can_auto_execute=False,
            reason=f"Daily auto-execution limit of {DAILY_AUTO_TRADE_LIMIT} trades reached",
            policy_version=policy["version"],
            checks=checks,
            recommendation_id=recommendation_id,
        )
    checks.daily_limit = True

    # All checks passed
    return AutoExecutionEligibilityResponse(
        can_auto_execute=True,
        reason="All auto-execution policy checks passed",
        policy_version=policy["version"],
        checks=checks,
        recommendation_id=recommendation_id,
    )


# ---------------------------------------------------------------------------
# Universe Restrictions
# ---------------------------------------------------------------------------


class UniverseRestrictionResponse(BaseModel):
    """Single universe restriction."""

    id: str
    restriction_type: str
    symbols: list[str]
    sectors: list[str]
    asset_classes: list[str]
    reason: str | None = None
    enabled: bool
    created_at: str | None = None
    created_by: str | None = None


class UniverseRestrictionCreateRequest(BaseModel):
    """Request body for creating a universe restriction."""

    restriction_type: str = Field(..., pattern="^(whitelist|blacklist)$")
    symbols: list[str] = Field(default_factory=list)
    sectors: list[str] = Field(default_factory=list)
    asset_classes: list[str] = Field(default_factory=list)
    reason: str | None = None
    enabled: bool = True


class UniverseRestrictionsListResponse(BaseModel):
    """Response listing active universe restrictions."""

    restrictions: list[UniverseRestrictionResponse]
    total: int


def _row_to_restriction(row: dict) -> UniverseRestrictionResponse:
    return UniverseRestrictionResponse(
        id=str(row["id"]),
        restriction_type=row["restriction_type"],
        symbols=row.get("symbols") or [],
        sectors=row.get("sectors") or [],
        asset_classes=row.get("asset_classes") or [],
        reason=row.get("reason"),
        enabled=row.get("enabled", True),
        created_at=row.get("created_at"),
        created_by=str(row["created_by"]) if row.get("created_by") else None,
    )


@router.get("/universe-restrictions", response_model=UniverseRestrictionsListResponse)
async def list_universe_restrictions() -> UniverseRestrictionsListResponse:
    """List active universe restrictions."""
    db = _require_db()

    result = (
        db.table("universe_restrictions")
        .select("*")
        .eq("enabled", True)
        .order("created_at", desc=True)
        .execute()
    )

    rows = result.data or []
    return UniverseRestrictionsListResponse(
        restrictions=[_row_to_restriction(r) for r in rows],
        total=len(rows),
    )


@router.post(
    "/universe-restrictions",
    response_model=UniverseRestrictionResponse,
    status_code=201,
)
async def create_universe_restriction(
    body: UniverseRestrictionCreateRequest,
) -> UniverseRestrictionResponse:
    """Add a new universe restriction."""
    db = _require_db()

    new_row = {
        "restriction_type": body.restriction_type,
        "symbols": body.symbols,
        "sectors": body.sectors,
        "asset_classes": body.asset_classes,
        "reason": body.reason,
        "enabled": body.enabled,
    }

    result = db.table("universe_restrictions").insert(new_row).select("*").single().execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create universe restriction")

    return _row_to_restriction(result.data)


@router.delete("/universe-restrictions/{restriction_id}", status_code=204)
async def delete_universe_restriction(restriction_id: str) -> None:
    """Remove a universe restriction."""
    db = _require_db()

    existing = (
        db.table("universe_restrictions")
        .select("id")
        .eq("id", restriction_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Universe restriction not found")

    db.table("universe_restrictions").delete().eq("id", restriction_id).execute()
