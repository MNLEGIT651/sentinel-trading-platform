from pydantic_settings import BaseSettings, SettingsConfigDict


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
    engine_api_key: str = "sentinel-dev-key"

    # Broker
    broker_mode: str = "paper"
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"

    # CORS
    cors_origins: str = "http://localhost:3000"

    def validate(self) -> None:
        """Raise ValueError if any required environment variable is missing."""
        import logging

        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}. "
                "See .env.example for guidance."
            )
        optional_warnings = {
            "POLYGON_API_KEY": self.polygon_api_key,
            "ALPACA_API_KEY": self.alpaca_api_key,
        }
        for name, value in optional_warnings.items():
            if not value:
                logging.warning("Optional env var %s is not set — related features disabled.", name)
