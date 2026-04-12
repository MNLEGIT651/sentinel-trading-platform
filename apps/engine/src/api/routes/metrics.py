"""SLO metrics endpoint — exposes current health against SLO targets."""

from dataclasses import asdict

from fastapi import APIRouter

from src.metrics.collector import get_metrics_collector

router = APIRouter(tags=["metrics"])


@router.get("/metrics/slo")
async def get_slo_status():
    """Return current SLO health based on the sliding-window metrics.

    Response includes p95 latency per critical path, error rates, and
    budget consumption status (green/yellow/red) matching the targets
    defined in docs/runbooks/slo-dashboard-spec.md.
    """
    collector = get_metrics_collector()
    report = collector.compute_slo_report()
    return asdict(report)
