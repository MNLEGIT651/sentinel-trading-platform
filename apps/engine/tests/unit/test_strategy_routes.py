"""Tests for strategy API routes."""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestListStrategies:
    def test_returns_all_strategies(self, client):
        resp = client.get("/api/v1/strategies/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 11
        assert len(data["strategies"]) == data["total"]
        assert "families" in data

    def test_strategy_has_required_fields(self, client):
        resp = client.get("/api/v1/strategies/")
        data = resp.json()
        for strat in data["strategies"]:
            assert "name" in strat
            assert "family" in strat
            assert "description" in strat
            assert "default_params" in strat


class TestFamilyEndpoint:
    def test_trend_following(self, client):
        resp = client.get("/api/v1/strategies/families/trend_following")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert data["families"] == ["trend_following"]

    def test_momentum(self, client):
        resp = client.get("/api/v1/strategies/families/momentum")
        assert resp.status_code == 200
        assert resp.json()["total"] == 3

    def test_mean_reversion(self, client):
        resp = client.get("/api/v1/strategies/families/mean_reversion")
        assert resp.status_code == 200
        assert resp.json()["total"] == 3

    def test_value(self, client):
        resp = client.get("/api/v1/strategies/families/value")
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    def test_unknown_family_404(self, client):
        resp = client.get("/api/v1/strategies/families/nonexistent")
        assert resp.status_code == 404


class TestStrategyDetail:
    def test_get_sma_crossover(self, client):
        resp = client.get("/api/v1/strategies/sma_crossover")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "sma_crossover"
        assert data["family"] == "trend_following"
        assert "fast_period" in data["default_params"]
        assert "slow_period" in data["default_params"]

    def test_get_unknown_404(self, client):
        resp = client.get("/api/v1/strategies/nonexistent")
        assert resp.status_code == 404
