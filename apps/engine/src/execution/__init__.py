"""Execution module — broker adapters and order management."""

import logging
from functools import lru_cache

from src.config import Settings
from src.execution.broker_interface import BrokerAdapter
from src.execution.paper_broker import PaperBroker

logger = logging.getLogger(__name__)


@lru_cache
def get_broker() -> BrokerAdapter:
    """Return a configured broker adapter based on settings.

    In ``live`` mode, Alpaca credentials are mandatory — missing credentials
    raise ``ValueError`` so the engine fails closed.

    In ``paper`` mode, Alpaca paper-API is preferred when credentials are
    present; otherwise the in-memory PaperBroker is used as a fallback.
    """
    settings = Settings()

    if settings.broker_mode == "live":
        if not settings.alpaca_api_key or not settings.alpaca_secret_key:
            raise ValueError("BROKER_MODE=live requires ALPACA_API_KEY and ALPACA_SECRET_KEY")
        if "paper" in settings.alpaca_base_url:
            raise ValueError(
                "BROKER_MODE=live but ALPACA_BASE_URL points to the paper "
                "trading endpoint. Use https://api.alpaca.markets for live."
            )

        from src.execution.alpaca_broker import AlpacaBroker

        logger.info("Using Alpaca broker (LIVE mode)")
        return AlpacaBroker(
            api_key=settings.alpaca_api_key,
            secret_key=settings.alpaca_secret_key,
            base_url=settings.alpaca_base_url,
            broker_mode="live",
        )

    # Paper mode
    if settings.alpaca_api_key and settings.alpaca_secret_key:
        from src.execution.alpaca_broker import AlpacaBroker

        logger.info(
            "Using Alpaca broker (paper mode via %s)",
            settings.alpaca_base_url,
        )
        return AlpacaBroker(
            api_key=settings.alpaca_api_key,
            secret_key=settings.alpaca_secret_key,
            base_url=settings.alpaca_base_url,
            broker_mode="paper",
        )

    logger.info("Alpaca credentials not set — using in-memory PaperBroker")
    return PaperBroker()
