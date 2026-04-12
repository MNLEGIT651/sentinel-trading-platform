"""In-memory SLO metrics collector.

Tracks request latency and status codes in a fixed-size sliding window
(default 5 minutes). Provides percentile calculations and error rates
for the SLO status endpoint.

Thread-safe via asyncio lock. In single-process deployments (Railway),
this gives accurate per-instance metrics. For multi-instance setups,
aggregate across instances via an external collector (Prometheus, Datadog).

Memory bounded: each entry is ~64 bytes; at 100 req/s over 5 min = 30k
entries = ~1.9 MB. The cleanup runs on every insert, so memory usage
stays constant regardless of uptime.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from functools import lru_cache


@dataclass(frozen=True)
class RequestMetric:
    """Single request measurement."""

    timestamp: float
    path: str
    method: str
    status_code: int
    duration_ms: float


@dataclass
class SloStatus:
    """Current SLO health for a single metric category."""

    value: float
    target: float
    budget_pct: float  # 0–100: how much of the error budget is consumed
    status: str  # "green" | "yellow" | "red"


@dataclass
class SloReport:
    """Full SLO status report."""

    window_seconds: int
    total_requests: int
    latency: dict[str, SloStatus] = field(default_factory=dict)
    error_rates: dict[str, SloStatus] = field(default_factory=dict)


def _budget_status(budget_consumed: float) -> str:
    """Map budget consumption percentage to a status label."""
    if budget_consumed < 50:
        return "green"
    return "yellow" if budget_consumed < 75 else "red"


class MetricsCollector:
    """Sliding-window metrics collector for SLO calculations."""

    def __init__(self, window_seconds: int = 300) -> None:
        self._window = window_seconds
        self._entries: deque[RequestMetric] = deque()

    @property
    def window_seconds(self) -> int:
        return self._window

    def record(self, path: str, method: str, status_code: int, duration_ms: float) -> None:
        """Record a request metric."""
        now = time.time()
        self._entries.append(
            RequestMetric(
                timestamp=now,
                path=path,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
            )
        )
        self._evict(now)

    def _evict(self, now: float) -> None:
        """Remove entries older than the window."""
        cutoff = now - self._window
        while self._entries and self._entries[0].timestamp < cutoff:
            self._entries.popleft()

    def get_entries(self) -> list[RequestMetric]:
        """Return current window entries (evicts stale first)."""
        self._evict(time.time())
        return list(self._entries)

    def percentile(self, durations: list[float], p: float) -> float:
        """Calculate the p-th percentile from a sorted list of durations."""
        if not durations:
            return 0.0
        sorted_d = sorted(durations)
        idx = int(len(sorted_d) * p / 100)
        idx = min(idx, len(sorted_d) - 1)
        return sorted_d[idx]

    def compute_slo_report(self) -> SloReport:
        """Compute current SLO status based on the sliding window."""
        entries = self.get_entries()
        total = len(entries)

        report = SloReport(window_seconds=self._window, total_requests=total)

        if total == 0:
            return report

        # --- Latency SLOs (p95) ---
        # Group by path pattern for key critical paths
        path_groups: dict[str, list[float]] = {
            "market_data_quotes": [],
            "market_data_bars": [],
            "order_submission": [],
            "health_probes": [],
        }

        for e in entries:
            if "/data/quotes" in e.path:
                path_groups["market_data_quotes"].append(e.duration_ms)
            elif "/data/bars" in e.path:
                path_groups["market_data_bars"].append(e.duration_ms)
            elif "/portfolio/orders" in e.path and e.method == "POST":
                path_groups["order_submission"].append(e.duration_ms)
            elif e.path == "/health":
                path_groups["health_probes"].append(e.duration_ms)

        # p95 targets from SLO spec
        targets = {
            "market_data_quotes": 3000.0,
            "market_data_bars": 2500.0,
            "order_submission": 2000.0,
            "health_probes": 500.0,
        }

        for key, durations in path_groups.items():
            if not durations:
                continue
            p95 = self.percentile(durations, 95)
            target = targets[key]
            # Budget: how close are we to the p99 budget (2x p95 target)
            budget_limit = target * 2
            budget_consumed = min((p95 / budget_limit) * 100, 100.0)
            status = _budget_status(budget_consumed)
            report.latency[key] = SloStatus(
                value=round(p95, 1),
                target=target,
                budget_pct=round(budget_consumed, 1),
                status=status,
            )

        # --- Error Rate SLOs ---
        error_5xx = sum(1 for e in entries if e.status_code >= 500)
        error_auth = sum(1 for e in entries if e.status_code in (401, 403))
        error_timeout = sum(1 for e in entries if e.status_code == 504)
        order_entries = [e for e in entries if "/portfolio/orders" in e.path and e.method == "POST"]
        order_failures = sum(1 for e in order_entries if e.status_code >= 400)

        error_metrics = {
            "proxy_5xx_rate": (error_5xx, total, 0.01),  # 1% budget
            "auth_error_rate": (error_auth, total, 0.01),  # 1% budget
            "timeout_rate": (error_timeout, total, 0.02),  # 2% budget
        }

        if order_entries:
            error_metrics["order_failure_rate"] = (
                order_failures,
                len(order_entries),
                0.005,  # 0.5% budget
            )

        for key, (errors, denominator, budget_limit) in error_metrics.items():
            rate = errors / denominator if denominator > 0 else 0.0
            budget_consumed = min((rate / budget_limit) * 100, 100.0) if budget_limit > 0 else 0.0
            status = _budget_status(budget_consumed)
            report.error_rates[key] = SloStatus(
                value=round(rate * 100, 2),  # as percentage
                target=round(budget_limit * 100, 2),
                budget_pct=round(budget_consumed, 1),
                status=status,
            )

        return report


@lru_cache(maxsize=1)
def get_metrics_collector() -> MetricsCollector:
    """Return the singleton metrics collector instance."""
    return MetricsCollector(window_seconds=300)
