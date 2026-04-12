"""Execution module — broker adapters and order management."""

import logging
from functools import lru_cache

from src.config import Settings
from src.execution.broker_interface import BrokerAdapter

logger = logging.getLogger(__name__)


@lru_cache
def get_broker() -> BrokerAdapter:
    """Return a configured broker adapter based on settings.

    broker_mode=paper  → PaperBroker (explicit paper trading)
    broker_mode=live   → AlpacaBroker (requires credentials, fails if missing)
    """
    settings = Settings()

    if settings.broker_mode == "paper":
        from src.execution.paper_broker import PaperBroker

        if settings.alpaca_api_key and settings.alpaca_secret_key:
            # Paper mode with Alpaca paper API
            from src.execution.alpaca_broker import AlpacaBroker

            logger.info("Using Alpaca broker (paper mode)")
            return AlpacaBroker(
                api_key=settings.alpaca_api_key,
                secret_key=settings.alpaca_secret_key,
                base_url=settings.alpaca_base_url,
            )
        logger.info("Using in-memory PaperBroker (explicit paper mode)")
        return PaperBroker()

    # Live mode — credentials are mandatory
    if not settings.alpaca_api_key or not settings.alpaca_secret_key:
        raise RuntimeError(
            "broker_mode is 'live' but ALPACA_API_KEY and/or ALPACA_SECRET_KEY "
            "are not set. Refusing to start without live broker credentials."
        )

    from src.execution.alpaca_broker import AlpacaBroker

    logger.info("Using Alpaca broker (LIVE mode)")
    return AlpacaBroker(
        api_key=settings.alpaca_api_key,
        secret_key=settings.alpaca_secret_key,
        base_url=settings.alpaca_base_url,
    )
