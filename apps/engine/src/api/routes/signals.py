"""Signal API routes.

Endpoints for listing and retrieving trading signals stored in Supabase.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/signals", tags=["signals"])


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------


class SignalDetail(BaseModel):
    """Full signal record from Supabase."""

    id: str
    instrument_id: str | None = None
    strategy_id: str | None = None
    direction: str | None = None
    strength: float | None = None
    confidence: float | None = None
    metadata: dict = Field(default_factory=dict)
    generated_at: str | None = None
    expires_at: str | None = None
    is_active: bool = True


class SignalListResponse(BaseModel):
    """Paginated list of signals."""

    signals: list[SignalDetail]
    total: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _row_to_signal(row: dict) -> SignalDetail:
    return SignalDetail(
        id=str(row["id"]),
        instrument_id=str(row["instrument_id"]) if row.get("instrument_id") else None,
        strategy_id=str(row["strategy_id"]) if row.get("strategy_id") else None,
        direction=row.get("direction"),
        strength=float(row["strength"]) if row.get("strength") is not None else None,
        confidence=float(row["confidence"]) if row.get("confidence") is not None else None,
        metadata=row.get("metadata") or {},
        generated_at=row.get("generated_at"),
        expires_at=row.get("expires_at"),
        is_active=row.get("is_active", True),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=SignalListResponse)
async def list_signals(
    instrument_id: str | None = Query(None, description="Filter by instrument UUID"),
    strategy_id: str | None = Query(None, description="Filter by strategy UUID"),
    direction: str | None = Query(None, description="Filter by direction (long/short)"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> SignalListResponse:
    """List signals with optional filters."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")

    query = db.table("signals").select("*", count="exact")

    if instrument_id is not None:
        query = query.eq("instrument_id", instrument_id)
    if strategy_id is not None:
        query = query.eq("strategy_id", strategy_id)
    if direction is not None:
        query = query.eq("direction", direction)
    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = query.order("generated_at", desc=True).range(offset, offset + limit - 1).execute()

    signals = [_row_to_signal(row) for row in (result.data or [])]
    total = result.count if result.count is not None else len(signals)

    return SignalListResponse(signals=signals, total=total)


@router.get("/{signal_id}", response_model=SignalDetail)
async def get_signal(signal_id: str) -> SignalDetail:
    """Get a single signal by ID."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured.")

    result = db.table("signals").select("*").eq("id", signal_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Signal not found: {signal_id}")

    return _row_to_signal(result.data)
