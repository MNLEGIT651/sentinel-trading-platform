"""Portfolio & trading API routes — account, positions, orders."""

import dataclasses
import logging
from enum import StrEnum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.api.models.responses import (
    AccountResponse,
    CancelOrderResponse,
    OrderResponse,
    OrderSubmitResponse,
    PositionResponse,
    StoredOrderResponse,
)
from src.execution import get_broker
from src.execution.broker_interface import OrderRequest
from src.execution.order_store import TERMINAL_STATUSES, get_order_store
from src.services.order_service import (
    check_live_execution_gate,
    check_trading_halts,
    fetch_live_price,
    run_pre_trade_risk_check,
)
from src.telemetry import get_tracer

logger = logging.getLogger(__name__)
_tracer = get_tracer(__name__)
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


@router.get("/account", response_model=AccountResponse)
async def get_account() -> AccountResponse:
    """Get broker account summary (cash, equity, buying power)."""
    try:
        broker = get_broker()
        data = await broker.get_account()
        return AccountResponse(**data)
    except Exception as exc:
        logger.error("Failed to fetch account: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/positions", response_model=list[PositionResponse])
async def get_positions() -> list[PositionResponse]:
    """Get all open positions from the broker."""
    try:
        broker = get_broker()
        data = await broker.get_positions()
        return [PositionResponse(**p) for p in data]
    except Exception as exc:
        logger.error("Failed to fetch positions: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/orders", response_model=OrderSubmitResponse)
async def submit_order(body: SubmitOrderBody) -> OrderSubmitResponse:
    """Submit a new order to the broker (pre-trade risk check enforced)."""
    from src.config import Settings as _Settings
    from src.execution.alpaca_broker import AlpacaBroker

    exp_id = _Settings().experiment_id
    await check_trading_halts(experiment_id=exp_id)

    try:
        broker = get_broker()

        # Gate live-broker orders on system_controls
        await check_live_execution_gate(broker)

        symbol = body.symbol.upper()

        price = await fetch_live_price(broker, symbol)
        check_price = body.limit_price if body.limit_price is not None else price
        if check_price is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Unable to determine a safe risk-check price for this order. "
                    "Provide limit_price or restore live quote data."
                ),
            )

        risk_result = await run_pre_trade_risk_check(
            broker=broker,
            ticker=symbol,
            quantity=int(body.quantity),
            price=check_price,
            side=body.side.value,
        )
        if not risk_result.allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Risk check blocked order: {risk_result.reason}",
            )
        effective_quantity = risk_result.adjusted_shares or int(body.quantity)

        request = OrderRequest(
            instrument_id=symbol,
            side=body.side.value,
            order_type=body.order_type.value,
            quantity=float(effective_quantity),
            limit_price=body.limit_price,
            stop_price=body.stop_price,
        )

        with _tracer.start_as_current_span(
            "portfolio.submit_order",
            attributes={
                "order.symbol": symbol,
                "order.side": body.side.value,
                "order.type": body.order_type.value,
                "order.quantity": float(effective_quantity),
            },
        ) as span:
            if isinstance(broker, AlpacaBroker):
                result = await broker.submit_order(request, time_in_force=body.time_in_force)
            else:
                result = await broker.submit_order(request, current_price=price)

            span.set_attribute("order.id", result.order_id)
            span.set_attribute("order.status", result.status)

        return OrderSubmitResponse(
            order_id=result.order_id,
            status=result.status,
            fill_price=result.fill_price,
            fill_quantity=result.fill_quantity,
            commission=result.commission,
            slippage=result.slippage,
            risk_note=risk_result.reason if risk_result.adjusted_shares else None,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Order submission failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/orders", response_model=list[OrderResponse])
async def get_orders(status: str = "open") -> list[OrderResponse]:
    """Get orders filtered by status."""
    try:
        broker = get_broker()
        data = await broker.get_orders(status=status)
        return [OrderResponse(**o) for o in data]
    except Exception as exc:
        logger.error("Failed to fetch orders: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/orders/history", response_model=list[StoredOrderResponse])
async def get_order_history(
    limit: int = 20, experiment_id: str | None = None
) -> list[StoredOrderResponse]:
    """Get recent order history. Optionally filter by experiment_id."""
    capped = min(max(limit, 1), 100)
    store = get_order_store()
    if experiment_id:
        orders = store.list_orders(experiment_id=experiment_id)
        orders.sort(key=lambda o: o.submitted_at, reverse=True)
        orders = orders[:capped]
    else:
        orders = store.recent(limit=capped)
    return [StoredOrderResponse(**dataclasses.asdict(o)) for o in orders]


@router.get("/orders/{order_id}", response_model=StoredOrderResponse)
async def get_order_by_id(order_id: str) -> StoredOrderResponse:
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

    return StoredOrderResponse(**dataclasses.asdict(order))


@router.delete("/orders/{order_id}", response_model=CancelOrderResponse)
async def cancel_order(order_id: str) -> CancelOrderResponse:
    """Cancel an open order."""
    try:
        broker = get_broker()
        await broker.cancel_order(order_id)
        return CancelOrderResponse(status="cancelled", order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Failed to cancel order: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
