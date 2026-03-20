from fastapi import APIRouter

from src.config import Settings

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """Return service health status."""
    settings = Settings()
    return {
        "status": "ok",
        "service": "sentinel-engine",
        "dependencies": {
            "polygon": bool(settings.polygon_api_key),
            "alpaca": bool(settings.alpaca_api_key and settings.alpaca_secret_key),
            "supabase": bool(settings.supabase_url and settings.supabase_service_role_key),
        },
    }
