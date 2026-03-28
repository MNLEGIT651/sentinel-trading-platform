from fastapi import APIRouter

from src.api.models.responses import DependencyStatus, HealthResponse
from src.config import Settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return service health status."""
    settings = Settings()
    return HealthResponse(
        status="ok",
        service="sentinel-engine",
        dependencies=DependencyStatus(
            polygon=bool(settings.polygon_api_key),
            alpaca=bool(settings.alpaca_api_key and settings.alpaca_secret_key),
            supabase=bool(settings.supabase_url and settings.supabase_service_role_key),
        ),
    )
