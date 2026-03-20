"""Portfolio & trading API routes — account, positions, orders."""

import dataclasses
import logging
from enum import StrEnum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.execution import get_broker
from src.execution.broker_interface import OrderRequest
from src.execution.order_store import TERMINAL_STATUSES, get_order_store
from src.risk.risk_manager import PortfolioState, RiskManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ── Request models ───────────────────────────────────────


class OrderSide(StrEnum):
    buy = "buy"
    sell = "sell"


class OrderType(StrEnum):
    market = "market"
    limit = "limit"
    stop = "stop"
    stop_limit = "stop_limit"


class SubmitOrderBody(BaseModel):
    symbol: str
    side: OrderSide
    order_type: OrderType = OrderType.market
    quantity: float
    limit_price: float | None = None
    stop_price: float | None = None
    time_in_force: str = "day"


# ── Endpoints ────────────────────────────────────────────


@router.get("/account")
async def get_account() -> dict:
    """Get broker account summary (cash, equity, buying power)."""
    try:
        broker = get_broker()
        return await broker.get_account()
    except Exception as exc:
        logger.error("Failed to fetch account: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/positions")
async def get_positions() -> list[dict]:
    """Get all open positions from the broker."""
    try:
        broker = get_broker()
        return await broker.get_positions()
    except Exception as exc:
        logger.error("Failed to fetch positions: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/orders")
async def submit_order(body: SubmitOrderBody) -> dict:
    """Submit a new order to the broker (pre-trade risk check enforced)."""
    try:
        broker = get_broker()

        from src.execution.alpaca_broker import AlpacaBroker

        # Fetch live price for risk check and paper fills
        price: float | None = None
        if isinstance(broker, AlpacaBroker):
            # Alpaca will provide the fill price; use a rough estimate for risk check
            pass
        else:
            from src.config import Settings
            from src.data.polygon_client import PolygonClient

            settings = Settings()
            polygon = PolygonClient(settings.polygon_api_key)
            try:
                bar = await polygon.get_latest_price(body.symbol.upper(), interactive=True)
                price = bar.close if bar else 100.0
            finally:
                await polygon.close()

        # ── Pre-trade risk check ────────────────────────────────────────
        acct, positions_raw = await broker.get_account(), await broker.get_positions()
        positions_value: dict[str, float] = {
            p["instrument_id"]: p.get("market_value", p["quantity"] * p.get("avg_price", 0))
            for p in positions_raw
        }
        check_price = price or body.limit_price or 100.0
        state = PortfolioState(
            equity=acct["equity"],
            cash=acct["cash"],
            peak_equity=acct.get("initial_capital", acct["equity"]),
            daily_starting_equity=acct.get("initial_capital", acct["equity"]),
            positions=positions_value,
            position_sectors={},
        )
        risk_result = RiskManager().pre_trade_check(
            ticker=body.symbol.upper(),
            shares=int(body.quantity),
            price=check_price,
            side=body.side.value,
            state=state,
        )
        if not risk_result.allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Risk check blocked order: {risk_result.reason}",
            )
        effective_quantity = risk_result.adjusted_shares or int(body.quantity)
        # ─────────────────────────────────────────────────────────────────

        request = OrderRequest(
            instrument_id=body.symbol.upper(),
            side=body.side.value,
            order_type=body.order_type.value,
            quantity=float(effective_quantity),
            limit_price=body.limit_price,
            stop_price=body.stop_price,
        )

        if isinstance(broker, AlpacaBroker):
            result = await broker.submit_order(request, time_in_force=body.time_in_force)
        else:
            result = await broker.submit_order(request, current_price=price)

        return {
            "order_id": result.order_id,
            "status": result.status,
            "fill_price": result.fill_price,
            "fill_quantity": result.fill_quantity,
            "commission": result.commission,
            "slippage": result.slippage,
            "risk_note": risk_result.reason if risk_result.adjusted_shares else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Order submission failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/orders")
async def get_orders(status: str = "open") -> list[dict]:
    """Get orders filtered by status."""
    try:
        broker = get_broker()
        return await broker.get_orders(status=status)
    except Exception as exc:
        logger.error("Failed to fetch orders: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/orders/history")
async def get_order_history(limit: int = 20) -> list[dict]:
    """Get recent order history from the in-memory store."""
    capped = min(max(limit, 1), 100)
    store = get_order_store()
    return [dataclasses.asdict(o) for o in store.recent(limit=capped)]


@router.get("/orders/{order_id}")
async def get_order_by_id(order_id: str) -> dict:
    """Get a single order by ID. Refreshes from Alpaca if non-terminal."""
    store = get_order_store()
    order = store.get(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order not found: {order_id}")

    # If the order is non-terminal and broker is Alpaca, refresh from API
    if order.status not in TERMINAL_STATUSES:
        broker = get_broker()
        from src.execution.alpaca_broker import AlpacaBroker

        if isinstance(broker, AlpacaBroker):
            refreshed = await broker.refresh_order(order_id)
            if refreshed is not None:
                order = refreshed

    return dataclasses.asdict(order)


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str) -> dict:
    """Cancel an open order."""
    try:
        broker = get_broker()
        await broker.cancel_order(order_id)
        return {"status": "cancelled", "order_id": order_id}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Failed to cancel order: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
