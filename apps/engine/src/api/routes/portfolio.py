"""Portfolio API routes (placeholder)."""

from fastapi import APIRouter

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/{account_id}")
async def get_portfolio(account_id: str) -> dict:
    """Get portfolio summary for an account (placeholder)."""
    return {
        "account_id": account_id,
        "positions": [],
        "cash": 100_000.0,
        "equity": 100_000.0,
    }
