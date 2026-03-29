"""Tests for AlpacaBrokerAPI client.

All HTTP calls are mocked via respx so no real credentials are needed.
"""

from __future__ import annotations

import pytest
import respx
from httpx import Response

from src.broker.alpaca_broker_api import AlpacaBrokerAPI, AlpacaBrokerAPIError
from src.config import Settings


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setenv("ALPACA_BROKER_API_KEY", "test-key")
    monkeypatch.setenv("ALPACA_BROKER_API_SECRET", "test-secret")
    monkeypatch.setenv(
        "ALPACA_BROKER_API_URL",
        "https://broker-api.sandbox.alpaca.markets",
    )
    return Settings(_env_file=None)


@pytest.fixture
def broker_api(settings):
    return AlpacaBrokerAPI(settings)


@pytest.fixture
def unconfigured_settings(monkeypatch):
    monkeypatch.delenv("ALPACA_BROKER_API_KEY", raising=False)
    monkeypatch.delenv("ALPACA_BROKER_API_SECRET", raising=False)
    return Settings(_env_file=None)


class TestAlpacaBrokerAPIConfig:
    def test_is_configured_with_credentials(self, broker_api):
        assert broker_api.is_configured is True

    def test_is_not_configured_without_credentials(self, unconfigured_settings):
        api = AlpacaBrokerAPI(unconfigured_settings)
        assert api.is_configured is False

    def test_auth_header_is_basic(self, broker_api):
        header = broker_api._auth_header()
        assert "Authorization" in header
        assert header["Authorization"].startswith("Basic ")


class TestAlpacaBrokerAPIError:
    def test_error_stores_status_and_detail(self):
        err = AlpacaBrokerAPIError(422, "Validation failed")
        assert err.status_code == 422
        assert err.detail == "Validation failed"
        assert "422" in str(err)


class TestAccountCreation:
    @respx.mock
    @pytest.mark.asyncio
    async def test_create_account_success(self, broker_api):
        respx.post("https://broker-api.sandbox.alpaca.markets/v1/accounts").mock(
            return_value=Response(
                200,
                json={"id": "acc-123", "status": "SUBMITTED", "account_number": "A1"},
            )
        )

        result = await broker_api.create_account({"contact": {}, "identity": {}})
        assert result["id"] == "acc-123"
        assert result["status"] == "SUBMITTED"

    @respx.mock
    @pytest.mark.asyncio
    async def test_create_account_error_raises(self, broker_api):
        respx.post("https://broker-api.sandbox.alpaca.markets/v1/accounts").mock(
            return_value=Response(422, text="Invalid SSN")
        )

        with pytest.raises(AlpacaBrokerAPIError) as exc:
            await broker_api.create_account({"invalid": "data"})
        assert exc.value.status_code == 422
        assert "Invalid SSN" in exc.value.detail

    @respx.mock
    @pytest.mark.asyncio
    async def test_get_account(self, broker_api):
        respx.get("https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-123").mock(
            return_value=Response(200, json={"id": "acc-123", "status": "ACTIVE"})
        )

        result = await broker_api.get_account("acc-123")
        assert result["status"] == "ACTIVE"


class TestDocuments:
    @respx.mock
    @pytest.mark.asyncio
    async def test_upload_document(self, broker_api):
        respx.post(
            "https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/documents/upload"
        ).mock(return_value=Response(200, json={"id": "doc-1"}))

        result = await broker_api.upload_document(
            "acc-1", "identity_verification", "base64==", "image/jpeg"
        )
        assert result["id"] == "doc-1"

    @respx.mock
    @pytest.mark.asyncio
    async def test_list_documents(self, broker_api):
        respx.get("https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/documents").mock(
            return_value=Response(200, json=[{"id": "doc-1"}, {"id": "doc-2"}])
        )

        result = await broker_api.list_documents("acc-1")
        assert len(result) == 2


class TestACHRelationships:
    @respx.mock
    @pytest.mark.asyncio
    async def test_create_ach_relationship(self, broker_api):
        respx.post(
            "https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/ach_relationships"
        ).mock(
            return_value=Response(
                200,
                json={"id": "rel-1", "status": "QUEUED", "bank_name": "Chase"},
            )
        )

        result = await broker_api.create_ach_relationship("acc-1", processor_token="proc-token")
        assert result["id"] == "rel-1"

    @respx.mock
    @pytest.mark.asyncio
    async def test_delete_ach_returns_empty_on_204(self, broker_api):
        respx.delete(
            "https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/ach_relationships/rel-1"
        ).mock(return_value=Response(204))

        result = await broker_api.delete_ach_relationship("acc-1", "rel-1")
        assert result == {}


class TestTransfers:
    @respx.mock
    @pytest.mark.asyncio
    async def test_create_transfer(self, broker_api):
        respx.post("https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/transfers").mock(
            return_value=Response(
                200,
                json={
                    "id": "txn-1",
                    "status": "QUEUED",
                    "amount": "1000.00",
                    "direction": "INCOMING",
                },
            )
        )

        result = await broker_api.create_transfer(
            "acc-1",
            relationship_id="rel-1",
            amount="1000.00",
            direction="INCOMING",
        )
        assert result["id"] == "txn-1"
        assert result["amount"] == "1000.00"

    @respx.mock
    @pytest.mark.asyncio
    async def test_list_transfers(self, broker_api):
        respx.get("https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/transfers").mock(
            return_value=Response(200, json=[{"id": "txn-1"}])
        )

        result = await broker_api.list_transfers("acc-1")
        assert len(result) == 1

    @respx.mock
    @pytest.mark.asyncio
    async def test_api_error_on_500(self, broker_api):
        respx.get("https://broker-api.sandbox.alpaca.markets/v1/accounts/acc-1/transfers").mock(
            return_value=Response(500, text="Internal server error")
        )

        with pytest.raises(AlpacaBrokerAPIError) as exc:
            await broker_api.list_transfers("acc-1")
        assert exc.value.status_code == 500
