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

    # Scheduling intervals (minutes)
    data_ingestion_interval_minutes: int = 1440
    signal_generation_interval_minutes: int = 15
    risk_update_interval_minutes: int = 5
