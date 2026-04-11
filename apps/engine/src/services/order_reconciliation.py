"""Background order reconciliation — sweep non-terminal orders against Alpaca.

Live Alpaca orders are often accepted asynchronously: `submit_order` returns
`accepted` or `new`, and the fill happens seconds to minutes later. Without a
periodic reconciliation pass, those orders would linger in the local order
store forever with their initial status, and downstream consumers (UI, risk,
P&L) would see stale state.

This module runs a lightweight asyncio task that wakes every
``order_reconciliation_interval_seconds`` (default 30s), lists non-terminal
orders from the store, and calls ``AlpacaBroker.refresh_order()`` for each.
The task is a no-op when the configured broker is not ``AlpacaBroker``.

Design notes:
- Individual refresh failures are logged and swallowed so one bad order ID
  cannot stall the loop.
- Sweeps are sequential (not concurrent) to stay well under Alpaca's rate
  limit of 200 req/min per account.
- The task is started from the FastAPI lifespan and cancelled cleanly on
  shutdown; cancellation is propagated via ``asyncio.CancelledError``.
- Setting the interval to 0 disables reconciliation entirely (useful for
  tests and PaperBroker-only deployments).
"""

from __future__ import annotations

import asyncio
import logging

from src.execution import get_broker
from src.execution.order_store import TERMINAL_STATUSES, get_order_store

logger = logging.getLogger(__name__)


async def reconcile_once() -> int:
    """Run a single reconciliation pass.

    Returns the number of orders refreshed. Safe to call manually (e.g. from
    tests or an admin endpoint).
    """
    from src.execution.alpaca_broker import AlpacaBroker

    broker = get_broker()
    if not isinstance(broker, AlpacaBroker):
        return 0

    store = get_order_store()
    non_terminal = [o for o in store.list_orders() if o.status not in TERMINAL_STATUSES]
    if not non_terminal:
        return 0

    refreshed = 0
    for order in non_terminal:
        try:
            result = await broker.refresh_order(order.order_id)
            if result is not None:
                refreshed += 1
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(
                "order_reconciliation: refresh failed for %s: %s",
                order.order_id,
                exc,
            )

    if refreshed:
        logger.info(
            "order_reconciliation: refreshed %d/%d non-terminal orders",
            refreshed,
            len(non_terminal),
        )
    return refreshed


async def reconciliation_loop(interval_seconds: float) -> None:
    """Long-running loop that calls ``reconcile_once`` every ``interval_seconds``.

    Exits cleanly on ``asyncio.CancelledError``. Any other exception is logged
    and the loop continues — the goal is maximum uptime so live-order state
    stays fresh.
    """
    if interval_seconds <= 0:
        logger.info("order_reconciliation: disabled (interval=%s)", interval_seconds)
        return

    logger.info("order_reconciliation: starting loop (interval=%.1fs)", interval_seconds)
    try:
        while True:
            try:
                await reconcile_once()
            except asyncio.CancelledError:
                raise
            except Exception:  # pragma: no cover - defensive
                logger.exception("order_reconciliation: sweep failed; continuing")
            await asyncio.sleep(interval_seconds)
    except asyncio.CancelledError:
        logger.info("order_reconciliation: loop cancelled, shutting down")
        raise


def start_reconciliation_task(interval_seconds: float) -> asyncio.Task | None:
    """Create and schedule the reconciliation task.

    Returns ``None`` if the feature is disabled (interval <= 0), otherwise the
    ``asyncio.Task`` that the caller must cancel and await during shutdown.
    """
    if interval_seconds <= 0:
        logger.info("order_reconciliation: not starting (disabled)")
        return None
    return asyncio.create_task(
        reconciliation_loop(interval_seconds),
        name="order-reconciliation",
    )
