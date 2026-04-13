import logging

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.api.models.responses import DependencyStatus, HealthResponse
from src.config import Settings

router = APIRouter()
_logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check() -> JSONResponse:
    """Return service health status with live connectivity probes.

    Always returns 200 (liveness semantics). Use /ready for readiness gating.
    """
    settings = Settings()

    supabase_configured = bool(settings.supabase_url and settings.supabase_service_role_key)
    supabase_reachable = False
    if supabase_configured:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(
                    f"{settings.supabase_url}/rest/v1/",
                    headers={
                        "apikey": settings.supabase_service_role_key,
                        "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    },
                )
                supabase_reachable = resp.is_success
        except Exception:
            _logger.debug("Supabase health probe failed", exc_info=True)

    polygon_ok = bool(settings.polygon_api_key)
    alpaca_ok = bool(settings.alpaca_api_key and settings.alpaca_secret_key)

    degraded = supabase_configured and not supabase_reachable
    status = "degraded" if degraded else "ok"

    body = HealthResponse(
        status=status,
        service="sentinel-engine",
        dependencies=DependencyStatus(
            polygon=polygon_ok,
            alpaca=alpaca_ok,
            supabase=supabase_reachable if supabase_configured else False,
        ),
    )

    # Always return 200 — the process is alive and can serve requests.
    # Dependency degradation is reported in the body, not the HTTP status.
    # Returning 503 caused the web UI to show "Engine Offline" during
    # transient Supabase hiccups, which is misleading.
    return JSONResponse(
        content=body.model_dump(),
        status_code=200,
    )


@router.get("/ready")
async def readiness_check() -> JSONResponse:
    """Return 200 when the service is ready to handle traffic, 503 otherwise.

    Use this for deploy/startup gating. Unlike /health (liveness), this
    endpoint returns 503 when critical dependencies are unreachable.
    """
    settings = Settings()

    supabase_configured = bool(settings.supabase_url and settings.supabase_service_role_key)
    supabase_reachable = False
    if supabase_configured:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(
                    f"{settings.supabase_url}/rest/v1/",
                    headers={
                        "apikey": settings.supabase_service_role_key,
                        "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    },
                )
                supabase_reachable = resp.is_success
        except Exception:
            _logger.debug("Supabase readiness probe failed", exc_info=True)

    ready = not supabase_configured or supabase_reachable

    return JSONResponse(
        content={
            "ready": ready,
            "service": "sentinel-engine",
            "checks": {
                "supabase": supabase_reachable if supabase_configured else "not_configured",
            },
        },
        status_code=200 if ready else 503,
    )
