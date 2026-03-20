"""Alpaca Markets broker adapter for paper and live trading."""

import logging
from datetime import UTC, datetime

import httpx

from src.execution.broker_interface import BrokerAdapter, OrderRequest, OrderResult
from src.execution.order_store import StoredOrder, get_order_store

logger = logging.getLogger(__name__)


class AlpacaBroker(BrokerAdapter):
    """Broker adapter that connects to Alpaca's Trading API v2."""

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: str = "https://paper-api.alpaca.markets",
    ) -> None:
        if not api_key or not secret_key:
            raise ValueError("Alpaca API key and secret key are required")
        # Normalize: strip trailing /v2 if user included it in their base URL
        normalized = base_url.rstrip("/")
        if normalized.endswith("/v2"):
            normalized = normalized[:-3]
        self._http = httpx.AsyncClient(
            base_url=normalized,
            headers={
                "APCA-API-KEY-ID": api_key,
                "APCA-API-SECRET-KEY": secret_key,
            },
            timeout=15.0,
        )

    async def get_account(self) -> dict:
        """Get Alpaca account summary."""
        res = await self._http.get("/v2/account")
        res.raise_for_status()
        acct = res.json()
        return {
            "account_id": acct["id"],
            "status": acct["status"],
            "cash": float(acct["cash"]),
            "positions_value": float(acct["long_market_value"]) + float(acct["short_market_value"]),
            "equity": float(acct["equity"]),
            "buying_power": float(acct["buying_power"]),
            "initial_capital": float(acct["last_equity"]),
            "pattern_day_trader": acct.get("pattern_day_trader", False),
            "day_trade_count": int(acct.get("daytrade_count", 0)),
            "currency": acct.get("currency", "USD"),
        }

    async def get_positions(self) -> list[dict]:
        """Get all open positions from Alpaca."""
        res = await self._http.get("/v2/positions")
        res.raise_for_status()
        positions = res.json()
        return [
            {
                "instrument_id": p["symbol"],
                "quantity": float(p["qty"]),
                "avg_price": float(p["avg_entry_price"]),
                "market_value": float(p["market_value"]),
                "current_price": float(p["current_price"]),
                "unrealized_pl": float(p["unrealized_pl"]),
                "unrealized_plpc": float(p["unrealized_plpc"]),
                "side": p["side"],
            }
            for p in positions
        ]

    async def submit_order(self, order: OrderRequest, **kwargs) -> OrderResult:
        """Submit an order to Alpaca."""
        payload: dict = {
            "symbol": order.instrument_id,
            "qty": str(order.quantity),
            "side": order.side,
            "type": order.order_type,
            "time_in_force": kwargs.get("time_in_force", "day"),
        }
        if order.limit_price is not None:
            payload["limit_price"] = str(order.limit_price)
        if order.stop_price is not None:
            payload["stop_price"] = str(order.stop_price)

        res = await self._http.post("/v2/orders", json=payload)
        res.raise_for_status()
        data = res.json()

        get_order_store().add(
            StoredOrder(
                order_id=data["id"],
                symbol=order.instrument_id,
                side=order.side,
                order_type=order.order_type,
                qty=order.quantity,
                filled_qty=float(data["filled_qty"]) if data.get("filled_qty") else 0,
                status=data["status"],
                fill_price=float(data["filled_avg_price"])
                if data.get("filled_avg_price")
                else None,
                submitted_at=data.get("submitted_at", datetime.now(UTC).isoformat()),
                filled_at=data.get("filled_at"),
                risk_note=None,
            )
        )

        return OrderResult(
            order_id=data["id"],
            status=data["status"],
            fill_price=float(data["filled_avg_price"]) if data.get("filled_avg_price") else None,
            fill_quantity=float(data["filled_qty"]) if data.get("filled_qty") else None,
        )

    async def cancel_order(self, order_id: str) -> None:
        """Cancel an order on Alpaca."""
        res = await self._http.delete(f"/v2/orders/{order_id}")
        res.raise_for_status()

    async def get_orders(self, status: str = "open") -> list[dict]:
        """Get orders with given status (open, closed, all)."""
        res = await self._http.get("/v2/orders", params={"status": status, "limit": 100})
        res.raise_for_status()
        return [
            {
                "order_id": o["id"],
                "symbol": o["symbol"],
                "side": o["side"],
                "type": o["type"],
                "qty": float(o["qty"]),
                "filled_qty": float(o["filled_qty"]) if o.get("filled_qty") else 0,
                "status": o["status"],
                "submitted_at": o["submitted_at"],
                "filled_avg_price": float(o["filled_avg_price"])
                if o.get("filled_avg_price")
                else None,
            }
            for o in res.json()
        ]

    async def refresh_order(self, order_id: str) -> StoredOrder | None:
        """Fetch a single order from Alpaca and update the store."""
        try:
            res = await self._http.get(f"/v2/orders/{order_id}")
            res.raise_for_status()
        except httpx.HTTPStatusError:
            return None
        o = res.json()
        store = get_order_store()
        updated = store.update(
            order_id,
            status=o["status"],
            filled_qty=float(o["filled_qty"]) if o.get("filled_qty") else 0,
            fill_price=(float(o["filled_avg_price"]) if o.get("filled_avg_price") else None),
            filled_at=o.get("filled_at"),
        )
        return updated

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()
