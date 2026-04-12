"""Tests for Sentry initialization in the telemetry module."""

from unittest.mock import MagicMock, patch

from src.telemetry import init_sentry


class TestInitSentry:
    def test_noop_when_dsn_empty(self):
        """Empty DSN means Sentry is disabled — no SDK calls."""
        result = init_sentry(dsn="")
        assert result is False

    def test_noop_when_dsn_none(self):
        """None DSN also disables Sentry."""
        result = init_sentry(dsn=None)  # type: ignore[arg-type]
        assert result is False

    def test_noop_when_sdk_not_installed(self, monkeypatch):
        """If sentry-sdk is not importable, return False gracefully."""
        import builtins

        original_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name == "sentry_sdk":
                raise ModuleNotFoundError("No module named 'sentry_sdk'")
            return original_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", mock_import)

        result = init_sentry(dsn="https://key@sentry.io/123")
        assert result is False

    @patch("src.telemetry.os.getenv", return_value="production")
    def test_initialises_when_dsn_and_sdk_present(self, mock_getenv):
        """With a valid DSN and sentry-sdk installed, init succeeds."""
        mock_sentry = MagicMock()
        mock_fastapi_integration = MagicMock()
        mock_starlette_integration = MagicMock()

        with patch.dict(
            "sys.modules",
            {
                "sentry_sdk": mock_sentry,
                "sentry_sdk.integrations": MagicMock(),
                "sentry_sdk.integrations.fastapi": MagicMock(
                    FastApiIntegration=mock_fastapi_integration
                ),
                "sentry_sdk.integrations.starlette": MagicMock(
                    StarletteIntegration=mock_starlette_integration
                ),
            },
        ):
            result = init_sentry(
                dsn="https://key@sentry.io/123",
                environment="staging",
                traces_sample_rate=0.5,
            )

        assert result is True
        mock_sentry.init.assert_called_once()
        call_kwargs = mock_sentry.init.call_args[1]
        assert call_kwargs["dsn"] == "https://key@sentry.io/123"
        assert call_kwargs["environment"] == "staging"
        assert call_kwargs["traces_sample_rate"] == 0.5
        assert call_kwargs["send_default_pii"] is False

    @patch("src.telemetry.os.getenv", return_value="production")
    def test_uses_railway_environment_fallback(self, mock_getenv):
        """When environment is empty, falls back to RAILWAY_ENVIRONMENT."""
        mock_sentry = MagicMock()

        with patch.dict(
            "sys.modules",
            {
                "sentry_sdk": mock_sentry,
                "sentry_sdk.integrations": MagicMock(),
                "sentry_sdk.integrations.fastapi": MagicMock(FastApiIntegration=MagicMock()),
                "sentry_sdk.integrations.starlette": MagicMock(StarletteIntegration=MagicMock()),
            },
        ):
            init_sentry(dsn="https://key@sentry.io/123", environment="")

        call_kwargs = mock_sentry.init.call_args[1]
        assert call_kwargs["environment"] == "production"
