import pytest

from src.config import Settings


def test_settings_defaults(monkeypatch):
    """Test that Settings has correct default values."""
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
    )
    assert settings.broker_mode == "paper"
    assert settings.engine_api_key == "sentinel-dev-key"
    assert settings.alpaca_base_url == "https://paper-api.alpaca.markets"
    assert settings.supabase_url == ""
    assert settings.polygon_api_key == ""


def test_validate_raises_when_supabase_url_missing(monkeypatch):
    """Settings.validate() raises ValueError if SUPABASE_URL is empty."""
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "some-key")
    s = Settings(_env_file=None)
    with pytest.raises(ValueError, match="SUPABASE_URL"):
        s.validate()


def test_validate_passes_when_required_vars_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "some-key")
    s = Settings(_env_file=None)
    s.validate()  # must not raise
