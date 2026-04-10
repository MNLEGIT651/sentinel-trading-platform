import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # External APIs
    polygon_api_key: str = ""

    # Engine
    engine_api_key: str = ""

    # Broker
    broker_mode: str = "paper"
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"

    # Alpaca Broker API (account creation, KYC, funding)
    alpaca_broker_api_key: str = ""
    alpaca_broker_api_secret: str = ""
    alpaca_broker_api_url: str = "https://broker-api.sandbox.alpaca.markets"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Experiment
    experiment_id: str = ""

    def validate(self) -> None:
        """Raise ValueError if any required environment variable is missing.

        In ``live`` broker mode, Alpaca credentials and a non-paper base URL
        are mandatory.  In ``paper`` mode, missing Alpaca credentials are
        acceptable (the in-memory PaperBroker is used instead).
        """
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            "ENGINE_API_KEY": self.engine_api_key,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}. "
                "See .env.example for guidance."
            )

        # ── Live-mode enforcement ────────────────────────────────────────
        if self.broker_mode == "live":
            live_missing: list[str] = []
            if not self.alpaca_api_key:
                live_missing.append("ALPACA_API_KEY")
            if not self.alpaca_secret_key:
                live_missing.append("ALPACA_SECRET_KEY")
            if live_missing:
                raise ValueError(
                    f"BROKER_MODE=live requires Alpaca credentials but "
                    f"{', '.join(live_missing)} are missing."
                )
            if "paper" in self.alpaca_base_url:
                raise ValueError(
                    "BROKER_MODE=live but ALPACA_BASE_URL points to the "
                    "paper trading endpoint. Set ALPACA_BASE_URL="
                    "https://api.alpaca.markets for live trading."
                )
        # ── Paper-mode warnings ──────────────────────────────────────────
        else:
            if not self.alpaca_api_key or not self.alpaca_secret_key:
                logger.warning(
                    "Broker-backed trading features are disabled because broker "
                    "configuration is incomplete. The in-memory PaperBroker will be used."
                )

        if not self.polygon_api_key:
            logger.warning(
                "Polygon-backed market data features are disabled because "
                "optional configuration is missing."
            )
        if not self.alpaca_broker_api_key or not self.alpaca_broker_api_secret:
            logger.warning(
                "Alpaca Broker API (account creation, KYC) is disabled because "
                "ALPACA_BROKER_API_KEY or ALPACA_BROKER_API_SECRET is not set."
            )
