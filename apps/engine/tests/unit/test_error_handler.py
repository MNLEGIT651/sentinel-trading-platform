import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import _settings, app


@pytest.mark.asyncio
async def test_http_exception_returns_error_and_detail():
    """Custom handler wraps HTTPException into {error, detail} shape."""
    headers = {"X-API-Key": _settings.engine_api_key}
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as client:
        response = await client.get("/nonexistent-route-xyz")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert "detail" in body
