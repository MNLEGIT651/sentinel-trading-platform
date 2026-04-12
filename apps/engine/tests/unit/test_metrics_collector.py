"""Tests for the SLO metrics collector."""

import time

import pytest

from src.metrics.collector import MetricsCollector, get_metrics_collector


@pytest.fixture
def collector():
    return MetricsCollector(window_seconds=60)


@pytest.fixture(autouse=True)
def _clear_singleton():
    get_metrics_collector.cache_clear()
    yield
    get_metrics_collector.cache_clear()


class TestMetricsCollector:
    def test_record_and_retrieve(self, collector):
        """Entries are stored and retrievable."""
        collector.record("/health", "GET", 200, 50.0)
        collector.record("/api/v1/data/quotes", "GET", 200, 1500.0)

        entries = collector.get_entries()
        assert len(entries) == 2
        assert entries[0].path == "/health"
        assert entries[1].duration_ms == 1500.0

    def test_eviction_removes_old_entries(self, collector):
        """Entries older than window are evicted."""
        # Insert an entry with a timestamp in the past
        collector.record("/old", "GET", 200, 100.0)
        # Manually backdate it
        collector._entries[0] = collector._entries[0].__class__(
            timestamp=time.time() - 120,  # 2 min ago, window is 60s
            path="/old",
            method="GET",
            status_code=200,
            duration_ms=100.0,
        )

        collector.record("/new", "GET", 200, 50.0)
        entries = collector.get_entries()

        assert len(entries) == 1
        assert entries[0].path == "/new"

    def test_percentile_calculation(self, collector):
        """Percentile math is correct."""
        durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        p50 = collector.percentile(durations, 50)
        p95 = collector.percentile(durations, 95)

        assert p50 == 60  # index 5
        assert p95 == 100  # index 9

    def test_percentile_empty_list(self, collector):
        assert collector.percentile([], 95) == 0.0

    def test_percentile_single_element(self, collector):
        assert collector.percentile([42.0], 95) == 42.0


class TestSloReport:
    def test_empty_report_when_no_data(self, collector):
        """No requests → empty report."""
        report = collector.compute_slo_report()
        assert report.total_requests == 0
        assert report.latency == {}
        assert report.error_rates == {}

    def test_latency_slo_green(self, collector):
        """Low latency → green status."""
        for _ in range(20):
            collector.record("/api/v1/data/quotes", "GET", 200, 500.0)

        report = collector.compute_slo_report()
        assert "market_data_quotes" in report.latency
        slo = report.latency["market_data_quotes"]
        assert slo.status == "green"
        assert slo.value <= 3000.0

    def test_latency_slo_red(self, collector):
        """High latency → red status."""
        for _ in range(20):
            collector.record("/api/v1/data/quotes", "GET", 200, 5000.0)

        report = collector.compute_slo_report()
        slo = report.latency["market_data_quotes"]
        assert slo.status == "red"

    def test_error_rate_green(self, collector):
        """Low error rate → green."""
        for _ in range(100):
            collector.record("/api/v1/something", "GET", 200, 100.0)

        report = collector.compute_slo_report()
        assert "proxy_5xx_rate" in report.error_rates
        slo = report.error_rates["proxy_5xx_rate"]
        assert slo.status == "green"
        assert slo.value == 0.0

    def test_error_rate_red(self, collector):
        """High 5xx rate → red."""
        for _ in range(50):
            collector.record("/api/v1/something", "GET", 200, 100.0)
        for _ in range(50):
            collector.record("/api/v1/something", "GET", 500, 100.0)

        report = collector.compute_slo_report()
        slo = report.error_rates["proxy_5xx_rate"]
        assert slo.status == "red"
        assert slo.value == 50.0  # 50%

    def test_order_failure_rate_tracked(self, collector):
        """Order failures are tracked separately."""
        for _ in range(10):
            collector.record("/api/v1/portfolio/orders", "POST", 200, 100.0)
        collector.record("/api/v1/portfolio/orders", "POST", 422, 100.0)

        report = collector.compute_slo_report()
        assert "order_failure_rate" in report.error_rates
        slo = report.error_rates["order_failure_rate"]
        # 1/11 = 9.09% — way above 0.5% budget → red
        assert slo.status == "red"

    def test_health_probe_latency(self, collector):
        """Health probes have their own SLO."""
        for _ in range(10):
            collector.record("/health", "GET", 200, 100.0)

        report = collector.compute_slo_report()
        assert "health_probes" in report.latency
        slo = report.latency["health_probes"]
        assert slo.target == 500.0
        assert slo.status == "green"


class TestGetMetricsCollector:
    def test_singleton_pattern(self):
        """get_metrics_collector returns the same instance."""
        c1 = get_metrics_collector()
        c2 = get_metrics_collector()
        assert c1 is c2

    def test_default_window(self):
        c = get_metrics_collector()
        assert c.window_seconds == 300
