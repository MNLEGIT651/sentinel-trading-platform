from src.config import Settings


def test_settings_defaults():
    """Test that Settings has correct default values."""
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
    )
    assert settings.broker_mode == "paper"
    assert settings.engine_api_key == "sentinel-dev-key"
    assert settings.alpaca_base_url == "https://paper-api.alpaca.markets"
    assert settings.data_ingestion_interval_minutes == 1440
    assert settings.signal_generation_interval_minutes == 15
    assert settings.risk_update_interval_minutes == 5
    assert settings.supabase_url == ""
    assert settings.polygon_api_key == ""
