# Engine Test Patterns Reference

Detailed patterns for writing pytest tests in `apps/engine/tests/`.

---

## Project Test Configuration

From `pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"      # all async tests run automatically
testpaths = ["tests"]
```

`asyncio_mode = "auto"` means `@pytest.mark.asyncio` decorators are not needed — async test functions just work.

---

## Conftest Fixtures

### Root `tests/conftest.py`

```python
import os
import pytest
from fastapi.testclient import TestClient
from src.api.main import app

@pytest.fixture(autouse=True)
def _stub_required_env(monkeypatch):
    """Provides minimum required env vars so Settings.validate() passes in CI."""
    monkeypatch.setenv("SUPABASE_URL", os.getenv("SUPABASE_URL", "https://stub.supabase.co"))
    monkeypatch.setenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key"),
    )

@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

The `_stub_required_env` fixture runs for **every test automatically** — env vars are always set. No need to set them in individual test files.

The `client` fixture is available globally but tests can also define their own local `client` fixture (which overrides the global one for that file).

---

## Standard Route Test Pattern

```python
"""Tests for [module] routes."""
import pytest
from fastapi.testclient import TestClient
from src.api.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestMyFeature:
    def test_success_case(self, client):
        resp = client.get("/api/v1/my-route")
        assert resp.status_code == 200
        data = resp.json()
        assert "expected_key" in data
        assert data["expected_key"] == "expected_value"

    def test_not_found(self, client):
        resp = client.get("/api/v1/my-route/nonexistent")
        assert resp.status_code == 404

    def test_post_with_body(self, client):
        resp = client.post("/api/v1/my-route", json={"field": "value"})
        assert resp.status_code == 200
```

---

## Mocking External HTTP (Broker Clients)

The active test suite uses Python's built-in `AsyncMock` to mock broker HTTP clients, not `respx` (which is installed but unused). Broker classes expose an internal `_http` attribute that can be replaced with a mock.

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from src.api.main import app
from src.brokers.alpaca import AlpacaBroker


@pytest.fixture
def client():
    return TestClient(app)


class TestAlpacaBroker:
    @pytest.mark.asyncio
    async def test_get_account(self):
        broker = AlpacaBroker(api_key="test", secret_key="test")
        broker._http = AsyncMock()
        broker._http.get = AsyncMock(return_value=MagicMock(
            status_code=200,
            json=lambda: {"cash": "95000", "equity": "102500", "buying_power": "47500"}
        ))

        account = await broker.get_account()
        assert account.cash == 95000.0
        assert account.equity == 102500.0

    @pytest.mark.asyncio
    async def test_submit_order(self):
        broker = AlpacaBroker(api_key="test", secret_key="test")
        broker._http = AsyncMock()
        broker._http.post = AsyncMock(return_value=MagicMock(
            status_code=200,
            json=lambda: {"id": "abc123", "status": "filled", "filled_avg_price": "150.00"}
        ))

        result = await broker.submit_order("AAPL", 10, "buy", "market")
        assert result.order_id == "abc123"
```

**Note on `asyncio_mode = "auto"`:** Integration tests are fully async (no decorator needed). Unit tests for broker async methods still use `@pytest.mark.asyncio` explicitly — the autouse only applies when the test itself is declared `async def` at module level, not inside a class.

## Mocking Supabase in Route Tests

Route tests that trigger database writes use `MagicMock` chaining on the `postgrest` client:

```python
from unittest.mock import MagicMock, patch

@patch("src.api.routes.portfolio.get_db")
def test_portfolio_route(mock_get_db, client):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    # Chain: db.table("orders").select("*").execute()
    mock_db.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=[{"id": "abc", "status": "filled"}]
    )

    resp = client.get("/api/v1/portfolio/positions")
    assert resp.status_code == 200
```

---

## Strategy and Logic Tests (No HTTP)

Tests for strategy logic, indicators, and risk don't need `respx` — they work with in-memory data:

```python
import numpy as np
import pandas as pd
import pytest
from src.strategies.sma_crossover import SMACrossoverStrategy


class TestSMACrossover:
    def test_generates_long_signal(self):
        strategy = SMACrossoverStrategy()
        # Build OHLCV where fast MA crosses above slow MA
        prices = np.array([100.0] * 50 + [110.0] * 10)
        data = pd.DataFrame({
            "open": prices, "high": prices * 1.01, "low": prices * 0.99,
            "close": prices, "volume": np.ones(60) * 100000
        })
        signal = strategy.generate(data, "AAPL")
        assert signal.direction == "long"
        assert signal.strength > 0

    def test_returns_flat_with_insufficient_data(self):
        strategy = SMACrossoverStrategy()
        data = pd.DataFrame({"close": [100.0, 101.0, 102.0]})  # too few bars
        signal = strategy.generate(data, "AAPL")
        assert signal.direction == "flat"
```

---

## Integration Test Setup (`tests/integration/conftest.py`)

Integration tests use the same `_stub_required_env` autouse fixture (inherited from root conftest) plus a shared async client:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from src.api.main import app

@pytest.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
```

Integration tests call the real app with async HTTP — useful for testing middleware, error handlers, and full request-response chains.

---

## Property-Based Testing with `hypothesis`

Used for testing strategies and indicators with generated data:

```python
from hypothesis import given, settings
from hypothesis import strategies as st
import numpy as np

@given(st.lists(st.floats(min_value=1.0, max_value=1000.0, allow_nan=False), min_size=60, max_size=200))
@settings(max_examples=50)
def test_rsi_always_between_0_and_100(prices):
    from src.indicators import calculate_rsi
    result = calculate_rsi(np.array(prices))
    # RSI must be bounded regardless of input
    assert all(0 <= v <= 100 for v in result if not np.isnan(v))
```

---

## Running Tests

```bash
# All tests
.venv/Scripts/python -m pytest apps/engine/tests -v

# Single file
.venv/Scripts/python -m pytest apps/engine/tests/unit/test_strategy_routes.py -v

# Single test method
.venv/Scripts/python -m pytest apps/engine/tests/unit/test_strategy_routes.py::TestListStrategies::test_returns_all_strategies -v

# With coverage
.venv/Scripts/python -m pytest apps/engine/tests --cov=src --cov-report=term-missing

# Fast fail on first error
.venv/Scripts/python -m pytest apps/engine/tests -x

# Integration tests only
.venv/Scripts/python -m pytest apps/engine/tests/integration -v
```
