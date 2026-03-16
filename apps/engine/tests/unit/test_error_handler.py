import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app


@pytest.mark.asyncio
async def test_http_exception_returns_error_and_detail():
    """Custom handler wraps HTTPException into {error, detail} shape."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/nonexistent-route-xyz")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert "detail" in body
