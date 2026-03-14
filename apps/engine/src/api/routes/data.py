"""Data ingestion API routes."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.config import Settings
from src.data.ingestion import DataIngestionService
from src.data.polygon_client import PolygonClient
from src.db import get_db

router = APIRouter(prefix="/data", tags=["data"])


class IngestRequest(BaseModel):
    """Request body for data ingestion."""

    tickers: list[str] = Field(..., min_length=1)
    timeframe: str = "1d"


class IngestResponse(BaseModel):
    """Response body for data ingestion."""

    ingested: int
    errors: list[str]


def get_ingestion_service() -> DataIngestionService:
    """Create a DataIngestionService with real dependencies."""
    settings = Settings()
    polygon = PolygonClient(api_key=settings.polygon_api_key)
    db = get_db()
    return DataIngestionService(polygon=polygon, db=db)


@router.post("/ingest", response_model=IngestResponse)
async def ingest_data(request: IngestRequest) -> IngestResponse:
    """Trigger data ingestion for the given tickers."""
    service = get_ingestion_service()
    result = await service.ingest_batch(tickers=request.tickers, timeframe=request.timeframe)
    return IngestResponse(ingested=result.ingested, errors=result.errors)
