"""Integration tests for the backtest routes.

The backtest engine uses synthetic data only — no external services required.
All endpoints should succeed with well-formed requests.
"""


async def test_list_backtestable_strategies_returns_200(client):
    """GET /api/v1/backtest/strategies returns available strategy names and trends."""
    response = await client.get("/api/v1/backtest/strategies")
    assert response.status_code == 200
    body = response.json()
    assert "strategies" in body
    assert "trends" in body
    assert isinstance(body["strategies"], list)
    assert len(body["strategies"]) > 0
    assert "sma_crossover" in body["strategies"]


async def test_run_backtest_returns_200_for_valid_request(client):
    """POST /api/v1/backtest/run returns a full BacktestResponse for sma_crossover."""
    response = await client.post(
        "/api/v1/backtest/run",
        json={
            "strategy_name": "sma_crossover",
            "bars": 100,
            "initial_capital": 50_000.0,
            "trend": "up",
            "seed": 42,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "summary" in body
    assert "equity_curve" in body
    assert "drawdown_curve" in body
    assert "trade_count" in body
    assert "trades" in body
    assert len(body["equity_curve"]) == 100


async def test_run_backtest_summary_has_expected_fields(client):
    """Backtest summary contains all required performance metrics."""
    response = await client.post(
        "/api/v1/backtest/run",
        json={
            "strategy_name": "sma_crossover",
            "bars": 100,
            "trend": "random",
            "seed": 99,
        },
    )
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert "strategy" in summary
    assert "ticker" in summary
    assert "total_return" in summary
    assert "annualized_return" in summary
    assert "max_drawdown" in summary
    assert "sharpe_ratio" in summary
    assert "win_rate" in summary
    assert "total_trades" in summary


async def test_run_backtest_unknown_strategy_returns_404(client):
    """POST /api/v1/backtest/run returns 404 for an unknown strategy name."""
    response = await client.post(
        "/api/v1/backtest/run",
        json={"strategy_name": "nonexistent_strategy_xyz"},
    )
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


async def test_run_backtest_invalid_trend_returns_422(client):
    """POST /api/v1/backtest/run returns 422 when trend value is invalid."""
    response = await client.post(
        "/api/v1/backtest/run",
        json={
            "strategy_name": "sma_crossover",
            "trend": "sideways",  # Not in the allowed pattern
        },
    )
    assert response.status_code == 422


async def test_run_backtest_bars_below_minimum_returns_422(client):
    """POST /api/v1/backtest/run returns 422 when bars < 50 (below ge constraint)."""
    response = await client.post(
        "/api/v1/backtest/run",
        json={
            "strategy_name": "sma_crossover",
            "bars": 10,  # Below minimum of 50
        },
    )
    assert response.status_code == 422


async def test_run_backtest_all_trends(client):
    """POST /api/v1/backtest/run succeeds for each supported trend type."""
    for trend in ["up", "down", "volatile", "random"]:
        response = await client.post(
            "/api/v1/backtest/run",
            json={
                "strategy_name": "rsi_momentum",
                "bars": 60,
                "trend": trend,
                "seed": 1,
            },
        )
        assert response.status_code == 200, f"Failed for trend={trend}"
