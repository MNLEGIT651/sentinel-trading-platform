"""Tests for onboarding engine routes.

Tests the Pydantic models and route logic. HTTP calls to Alpaca are mocked
so no real API credentials are needed.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.api.routes.onboarding import (
    BrokerApplicationRequest,
    ContactInfo,
    Disclosure,
    DocumentUploadRequest,
    IdentityInfo,
    TransferRequest,
)

# ─── Pydantic model tests ───────────────────────────────────────────


class TestPydanticModels:
    def test_contact_info_defaults(self):
        c = ContactInfo(email_address="test@example.com")
        assert c.phone_number == ""
        assert c.country == "USA"
        assert c.street_address == []

    def test_identity_info_defaults(self):
        i = IdentityInfo(
            given_name="John",
            family_name="Doe",
            date_of_birth="1990-01-01",
        )
        assert i.tax_id_type == "USA_SSN"
        assert i.country_of_citizenship == "USA"
        assert i.funding_source == ["employment_income"]

    def test_disclosure_defaults(self):
        d = Disclosure()
        assert d.is_control_person is False
        assert d.is_affiliated_exchange_or_finra is False
        assert d.is_politically_exposed is False

    def test_broker_application_request_defaults(self):
        req = BrokerApplicationRequest(
            contact=ContactInfo(email_address="test@example.com"),
            identity=IdentityInfo(
                given_name="Jane",
                family_name="Doe",
                date_of_birth="1995-06-15",
            ),
        )
        assert req.enabled_assets == ["us_equity"]
        assert req.agreements == []

    def test_transfer_request_defaults(self):
        t = TransferRequest(
            relationship_id="rel-123",
            amount="100.00",
        )
        assert t.direction == "INCOMING"

    def test_document_upload_request_defaults(self):
        d = DocumentUploadRequest(
            document_type="identity_verification",
            content="base64data",
        )
        assert d.mime_type == "image/jpeg"


# ─── Route tests with mocked Broker API ─────────────────────────────


@pytest.fixture
def mock_broker_api():
    """Patch AlpacaBrokerAPI methods on the module-level instance."""
    with (
        patch("src.api.routes.onboarding._broker_api") as mock_api,
    ):
        mock_api.is_configured = True
        mock_api.create_account = AsyncMock()
        mock_api.get_account = AsyncMock()
        mock_api.upload_document = AsyncMock()
        mock_api.list_documents = AsyncMock()
        mock_api.create_ach_relationship = AsyncMock()
        mock_api.list_ach_relationships = AsyncMock()
        mock_api.delete_ach_relationship = AsyncMock()
        mock_api.create_transfer = AsyncMock()
        mock_api.list_transfers = AsyncMock()
        yield mock_api


@pytest.fixture
def mock_unconfigured_broker():
    with patch("src.api.routes.onboarding._broker_api") as mock_api:
        mock_api.is_configured = False
        yield mock_api


class TestOnboardingRoutes:
    def test_broker_application_unconfigured(self, client, mock_unconfigured_broker):
        resp = client.post(
            "/api/v1/onboarding/broker-application",
            json={
                "contact": {"email_address": "test@example.com"},
                "identity": {
                    "given_name": "John",
                    "family_name": "Doe",
                    "date_of_birth": "1990-01-01",
                },
            },
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"]

    def test_broker_application_success(self, client, mock_broker_api):
        mock_broker_api.create_account.return_value = {
            "id": "acc-123",
            "status": "SUBMITTED",
            "account_number": "A12345",
        }

        resp = client.post(
            "/api/v1/onboarding/broker-application",
            json={
                "contact": {"email_address": "user@example.com"},
                "identity": {
                    "given_name": "Jane",
                    "family_name": "Smith",
                    "date_of_birth": "1995-03-20",
                },
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["account_id"] == "acc-123"
        assert data["status"] == "SUBMITTED"
        mock_broker_api.create_account.assert_awaited_once()

    def test_broker_status_success(self, client, mock_broker_api):
        mock_broker_api.get_account.return_value = {
            "id": "acc-123",
            "status": "ACTIVE",
            "account_number": "A12345",
            "crypto_status": "ACTIVE",
        }

        resp = client.get("/api/v1/onboarding/broker-status/acc-123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["account_id"] == "acc-123"
        assert data["status"] == "ACTIVE"

    def test_upload_document_success(self, client, mock_broker_api):
        mock_broker_api.upload_document.return_value = {"id": "doc-456"}

        resp = client.post(
            "/api/v1/onboarding/broker-documents/acc-123",
            json={
                "document_type": "identity_verification",
                "content": "base64data==",
                "mime_type": "image/png",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["document_id"] == "doc-456"

    def test_list_documents(self, client, mock_broker_api):
        mock_broker_api.list_documents.return_value = [
            {"id": "doc-1"},
            {"id": "doc-2"},
        ]

        resp = client.get("/api/v1/onboarding/broker-documents/acc-123")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_create_ach_relationship(self, client, mock_broker_api):
        mock_broker_api.create_ach_relationship.return_value = {
            "id": "rel-789",
            "status": "QUEUED",
            "bank_name": "Chase",
        }

        resp = client.post(
            "/api/v1/onboarding/ach-relationship/acc-123",
            json={"processor_token": "processor-sandbox-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["relationship_id"] == "rel-789"
        assert data["status"] == "QUEUED"

    def test_list_ach_relationships(self, client, mock_broker_api):
        mock_broker_api.list_ach_relationships.return_value = [
            {"id": "rel-1"},
        ]

        resp = client.get("/api/v1/onboarding/ach-relationships/acc-123")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_delete_ach_relationship(self, client, mock_broker_api):
        mock_broker_api.delete_ach_relationship.return_value = {}

        resp = client.delete("/api/v1/onboarding/ach-relationship/acc-123/rel-1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_create_transfer(self, client, mock_broker_api):
        mock_broker_api.create_transfer.return_value = {
            "id": "txn-101",
            "status": "QUEUED",
            "amount": "500.00",
            "direction": "INCOMING",
        }

        resp = client.post(
            "/api/v1/onboarding/transfer/acc-123",
            json={
                "relationship_id": "rel-789",
                "amount": "500.00",
                "direction": "INCOMING",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["transfer_id"] == "txn-101"
        assert data["amount"] == "500.00"

    def test_list_transfers(self, client, mock_broker_api):
        mock_broker_api.list_transfers.return_value = [{"id": "txn-1"}]

        resp = client.get("/api/v1/onboarding/transfers/acc-123")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
