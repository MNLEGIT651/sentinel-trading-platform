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

    If Alpaca credentials are set, uses AlpacaBroker (paper or live).
    Otherwise falls back to the in-memory PaperBroker.
    """
    settings = Settings()

    if settings.alpaca_api_key and settings.alpaca_secret_key:
        from src.execution.alpaca_broker import AlpacaBroker

        logger.info(
            "Using Alpaca broker (%s)",
            "paper" if "paper" in settings.alpaca_base_url else "live",
        )
        return AlpacaBroker(
            api_key=settings.alpaca_api_key,
            secret_key=settings.alpaca_secret_key,
            base_url=settings.alpaca_base_url,
        )

    logger.info("Alpaca credentials not set — using in-memory PaperBroker")
    return PaperBroker()
