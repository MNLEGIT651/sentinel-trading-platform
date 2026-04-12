"""Nightly portfolio reconciliation — verify local state against Alpaca.

Unlike the intra-day order reconciliation (which refreshes non-terminal order
statuses every 30s), this service performs a full audit of portfolio state:

1. Fetches authoritative account info and positions from Alpaca.
2. Cross-references Alpaca positions against filled orders in the local store.
3. Flags discrepancies: unaccounted positions (manual trades, dividends,
   corporate actions) and phantom orders (filled locally but no matching
   Alpaca position).
4. Emits structured logs for alerting (Sentry, CloudWatch, etc.).
5. Optionally writes a reconciliation snapshot to Supabase for compliance.

The default interval is 3600s (1 hour). In production, operators may increase
this to 86400s (24 hours, true nightly) or decrease for tighter monitoring.
Set to 0 to disable.

Design notes:
- Mirrors the structure of ``order_reconciliation.py`` for consistency.
- Single async sweep function + long-running loop + task starter.
- All exceptions are swallowed (logged) so the loop never dies.
- No-op when broker is not AlpacaBroker (PaperBroker has no external state).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime

from src.execution import get_broker
from src.execution.order_store import get_order_store

logger = logging.getLogger(__name__)


@dataclass
class ReconciliationReport:
    """Result of a single reconciliation sweep."""

    timestamp: str = ""
    alpaca_cash: float = 0.0
    alpaca_equity: float = 0.0
    alpaca_positions_count: int = 0
    local_filled_orders_count: int = 0
    unaccounted_positions: list[str] = field(default_factory=list)
    phantom_orders: list[str] = field(default_factory=list)
    has_discrepancies: bool = False


async def reconcile_portfolio_once() -> ReconciliationReport | None:
    """Run a single portfolio reconciliation pass.

    Returns a ReconciliationReport, or None if reconciliation is not applicable
    (e.g. broker is PaperBroker).
    """
    from src.execution.alpaca_broker import AlpacaBroker

    broker = get_broker()
    if not isinstance(broker, AlpacaBroker):
        return None

    report = ReconciliationReport(timestamp=datetime.now(UTC).isoformat())

    # 1. Fetch authoritative state from Alpaca
    account = await broker.get_account()
    positions = await broker.get_positions()

    report.alpaca_cash = account.get("cash", 0.0)
    report.alpaca_equity = account.get("equity", 0.0)
    report.alpaca_positions_count = len(positions)

    # 2. Build set of symbols with Alpaca positions
    alpaca_symbols = {p["instrument_id"] for p in positions}

    # 3. Get filled orders from local store and build expected positions
    store = get_order_store()
    all_orders = store.list_orders()
    filled_orders = [o for o in all_orders if o.status == "filled"]
    report.local_filled_orders_count = len(filled_orders)

    # Build net position per symbol from filled orders
    local_net: dict[str, float] = {}
    for order in filled_orders:
        qty = order.filled_qty if order.filled_qty else order.qty
        if order.side == "buy":
            local_net[order.symbol] = local_net.get(order.symbol, 0.0) + qty
        elif order.side == "sell":
            local_net[order.symbol] = local_net.get(order.symbol, 0.0) - qty

    # Symbols with net positive quantity (should correspond to Alpaca positions)
    local_position_symbols = {s for s, qty in local_net.items() if qty > 0}

    # 4. Detect discrepancies
    # Unaccounted: in Alpaca but NOT in local filled orders (manual trades, dividends, etc.)
    report.unaccounted_positions = sorted(alpaca_symbols - local_position_symbols)

    # Phantom: in local filled orders (net long) but NOT in Alpaca
    report.phantom_orders = sorted(local_position_symbols - alpaca_symbols)

    report.has_discrepancies = bool(report.unaccounted_positions or report.phantom_orders)

    # 5. Log results
    if report.has_discrepancies:
        logger.warning(
            "portfolio_reconciliation: discrepancies detected — "
            "unaccounted=%s, phantom=%s, alpaca_cash=%.2f, equity=%.2f",
            report.unaccounted_positions,
            report.phantom_orders,
            report.alpaca_cash,
            report.alpaca_equity,
        )
    else:
        logger.info(
            "portfolio_reconciliation: clean — "
            "positions=%d, filled_orders=%d, cash=%.2f, equity=%.2f",
            report.alpaca_positions_count,
            report.local_filled_orders_count,
            report.alpaca_cash,
            report.alpaca_equity,
        )

    # 6. Persist snapshot (best-effort, do not block on DB failure)
    _persist_snapshot(report)

    return report


def _persist_snapshot(report: ReconciliationReport) -> None:
    """Write reconciliation snapshot to Supabase (best-effort)."""
    try:
        from src.db import get_db

        db = get_db()
        if db is None:
            return
        db.table("reconciliation_snapshots").insert(
            {
                "timestamp": report.timestamp,
                "alpaca_cash": report.alpaca_cash,
                "alpaca_equity": report.alpaca_equity,
                "alpaca_positions_count": report.alpaca_positions_count,
                "local_filled_orders_count": report.local_filled_orders_count,
                "unaccounted_positions": report.unaccounted_positions,
                "phantom_orders": report.phantom_orders,
                "has_discrepancies": report.has_discrepancies,
            }
        ).execute()
    except Exception as exc:
        logger.warning("portfolio_reconciliation: snapshot persist failed: %s", exc)


async def portfolio_reconciliation_loop(interval_seconds: float) -> None:
    """Long-running loop that calls reconcile_portfolio_once periodically.

    Exits on CancelledError. All other exceptions are swallowed.
    """
    if interval_seconds <= 0:
        logger.info("portfolio_reconciliation: disabled (interval=%s)", interval_seconds)
        return

    logger.info("portfolio_reconciliation: starting loop (interval=%.1fs)", interval_seconds)
    try:
        while True:
            try:
                await reconcile_portfolio_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("portfolio_reconciliation: sweep failed; continuing")
            await asyncio.sleep(interval_seconds)
    except asyncio.CancelledError:
        logger.info("portfolio_reconciliation: loop cancelled, shutting down")
        raise


def start_portfolio_reconciliation_task(interval_seconds: float) -> asyncio.Task | None:
    """Create and schedule the portfolio reconciliation task.

    Returns None if disabled (interval <= 0).
    """
    if interval_seconds <= 0:
        logger.info("portfolio_reconciliation: not starting (disabled)")
        return None
    return asyncio.create_task(
        portfolio_reconciliation_loop(interval_seconds),
        name="portfolio-reconciliation",
    )
