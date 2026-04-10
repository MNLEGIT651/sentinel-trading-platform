"""Order submission service — extracted from portfolio routes.

Separates halt checks, price fetching, and risk validation into
discrete functions so the route handler stays thin.
"""

import logging

from fastapi import HTTPException

from src.db import get_db
from src.execution.broker_interface import BrokerAdapter
from src.risk.risk_manager import PortfolioState, PreTradeCheck, RiskManager

logger = logging.getLogger(__name__)


async def check_trading_halts(experiment_id: str | None = None) -> None:
    """Raise HTTPException(403) if system or experiment trading is halted."""
    db = get_db()
    if db is None:
        return

    # System-level halt
    try:
        row = db.table("system_controls").select("trading_halted").limit(1).single().execute()
        if row.data and row.data.get("trading_halted"):
            raise HTTPException(
                status_code=403,
                detail="Trading is halted. Cannot submit orders.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Could not check trading halt status: %s", exc)

    # Experiment-level halt
    if experiment_id:
        try:
            exp_row = (
                db.table("experiments").select("halted").eq("id", experiment_id).single().execute()
            )
            if exp_row.data and exp_row.data.get("halted"):
                raise HTTPException(
                    status_code=403,
                    detail="Experiment is halted. Cannot submit orders.",
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Could not check experiment halt status: %s", exc)


async def check_live_execution_gate(broker: BrokerAdapter) -> None:
    """Block live-broker orders unless system_controls authorizes live execution.

    Applies only when the configured broker would route orders to a real venue
    (i.e., AlpacaBroker pointed at a non-paper base URL). PaperBroker and
    Alpaca paper endpoints are allowed unconditionally because they cannot
    move real capital.

    Fails closed: if system_controls cannot be read, the order is blocked.
    The operator must explicitly set both:
      - system_controls.live_execution_enabled = true
      - system_controls.global_mode = 'live'
    before any live order is accepted.
    """
    from src.execution.alpaca_broker import AlpacaBroker

    # PaperBroker is always simulated; allow unconditionally.
    if not isinstance(broker, AlpacaBroker):
        return

    # Alpaca paper endpoint also cannot move real capital.
    if "paper" in broker.base_url.lower():
        return

    db = get_db()
    if db is None:
        logger.error(
            "Live execution gate triggered but database is not configured; blocking order."
        )
        raise HTTPException(
            status_code=503,
            detail=(
                "Live execution requires system_controls verification, "
                "but the database is not configured."
            ),
        )

    try:
        row = (
            db.table("system_controls")
            .select("live_execution_enabled,global_mode")
            .limit(1)
            .single()
            .execute()
        )
    except Exception as exc:
        logger.error("Failed to read system_controls for live execution gate: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=("Live execution gate check failed; refusing order as a safety default."),
        ) from exc

    controls = row.data or {}
    if not controls.get("live_execution_enabled", False):
        raise HTTPException(
            status_code=403,
            detail=(
                "Live execution is disabled. Set "
                "system_controls.live_execution_enabled=true to authorize live orders."
            ),
        )

    mode = controls.get("global_mode", "paper")
    if mode != "live":
        raise HTTPException(
            status_code=403,
            detail=(
                f"System is in '{mode}' mode. Set system_controls.global_mode='live' "
                "to authorize live orders."
            ),
        )


async def fetch_live_price(broker: BrokerAdapter, symbol: str) -> float | None:
    """Fetch the latest price via Polygon for non-Alpaca brokers.

    Returns None when using Alpaca (which provides its own fill price).
    """
    from src.execution.alpaca_broker import AlpacaBroker

    if isinstance(broker, AlpacaBroker):
        return None

    from src.config import Settings
    from src.data.polygon_client import PolygonClient

    settings = Settings()
    polygon = PolygonClient(settings.polygon_api_key)
    try:
        bar = await polygon.get_latest_price(symbol, interactive=True)
        return bar.close if bar else 100.0
    finally:
        await polygon.close()


async def run_pre_trade_risk_check(
    broker: BrokerAdapter,
    ticker: str,
    quantity: int,
    price: float,
    side: str,
) -> PreTradeCheck:
    """Build portfolio state from the broker and run the pre-trade risk check."""
    acct, positions_raw = await broker.get_account(), await broker.get_positions()
    positions_value: dict[str, float] = {
        p["instrument_id"]: p.get("market_value", p["quantity"] * p.get("avg_price", 0))
        for p in positions_raw
    }
    state = PortfolioState(
        equity=acct["equity"],
        cash=acct["cash"],
        peak_equity=acct.get("initial_capital", acct["equity"]),
        daily_starting_equity=acct.get("initial_capital", acct["equity"]),
        positions=positions_value,
        position_sectors={},
    )
    return RiskManager().pre_trade_check(
        ticker=ticker,
        shares=quantity,
        price=price,
        side=side,
        state=state,
    )
