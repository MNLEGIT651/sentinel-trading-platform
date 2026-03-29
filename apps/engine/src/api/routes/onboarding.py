"""Engine API routes for brokerage account onboarding.

These endpoints proxy KYC and funding operations to the Alpaca Broker API.
PII flows directly to Alpaca — the engine never persists it.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.broker.alpaca_broker_api import AlpacaBrokerAPI, AlpacaBrokerAPIError
from src.config import Settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["onboarding"])

_settings = Settings()
_broker_api = AlpacaBrokerAPI(_settings)


def _require_broker_api() -> None:
    if not _broker_api.is_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "Alpaca Broker API is not configured. "
                "Set ALPACA_BROKER_API_KEY and ALPACA_BROKER_API_SECRET."
            ),
        )


# ─── Models ──────────────────────────────────────────────────────────


class ContactInfo(BaseModel):
    email_address: str
    phone_number: str = ""
    street_address: list[str] = Field(default_factory=list)
    city: str = ""
    state: str = ""
    postal_code: str = ""
    country: str = "USA"


class IdentityInfo(BaseModel):
    given_name: str
    family_name: str
    date_of_birth: str  # YYYY-MM-DD
    tax_id: str = ""
    tax_id_type: str = "USA_SSN"
    country_of_citizenship: str = "USA"
    country_of_birth: str = "USA"
    country_of_tax_residence: str = "USA"
    funding_source: list[str] = Field(default_factory=lambda: ["employment_income"])


class Disclosure(BaseModel):
    is_control_person: bool = False
    is_affiliated_exchange_or_finra: bool = False
    is_politically_exposed: bool = False
    immediate_family_exposed: bool = False


class Agreement(BaseModel):
    agreement: str  # e.g. "customer_agreement"
    signed_at: str  # ISO-8601
    ip_address: str


class BrokerApplicationRequest(BaseModel):
    """Data required for Alpaca Broker API account creation.

    PII here is sent directly to Alpaca — not stored in our DB.
    """

    contact: ContactInfo
    identity: IdentityInfo
    disclosures: Disclosure = Field(default_factory=Disclosure)
    agreements: list[Agreement] = Field(default_factory=list)
    enabled_assets: list[str] = Field(default_factory=lambda: ["us_equity"])


class DocumentUploadRequest(BaseModel):
    document_type: str  # identity_verification, address_verification, etc.
    content: str  # base64-encoded
    mime_type: str = "image/jpeg"


class AchRelationshipRequest(BaseModel):
    processor_token: str  # Plaid processor token


class TransferRequest(BaseModel):
    relationship_id: str
    amount: str  # e.g. "1000.00"
    direction: str = "INCOMING"  # INCOMING (deposit) or OUTGOING (withdrawal)


# ─── Routes ──────────────────────────────────────────────────────────


@router.post("/onboarding/broker-application")
async def submit_broker_application(
    req: BrokerApplicationRequest,
) -> dict[str, Any]:
    """Submit a brokerage account application to Alpaca.

    The application includes KYC data (name, DOB, address, tax ID, etc.).
    This data is sent directly to Alpaca and NOT stored locally.
    """
    _require_broker_api()

    application = {
        "contact": req.contact.model_dump(),
        "identity": req.identity.model_dump(),
        "disclosures": req.disclosures.model_dump(),
        "agreements": [a.model_dump() for a in req.agreements],
        "enabled_assets": req.enabled_assets,
    }

    try:
        result = await _broker_api.create_account(application)
        logger.info(
            "Broker application submitted. Account ID: %s, Status: %s",
            result.get("id"),
            result.get("status"),
        )
        return {
            "account_id": result.get("id"),
            "status": result.get("status"),
            "account_number": result.get("account_number"),
        }
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.get("/onboarding/broker-status/{account_id}")
async def get_broker_status(account_id: str) -> dict[str, Any]:
    """Check the status of a brokerage account application."""
    _require_broker_api()

    try:
        result = await _broker_api.get_account(account_id)
        return {
            "account_id": result.get("id"),
            "status": result.get("status"),
            "account_number": result.get("account_number"),
            "crypto_status": result.get("crypto_status"),
        }
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.post("/onboarding/broker-documents/{account_id}")
async def upload_broker_document(account_id: str, req: DocumentUploadRequest) -> dict[str, Any]:
    """Upload an identity document for KYC verification."""
    _require_broker_api()

    try:
        result = await _broker_api.upload_document(
            account_id, req.document_type, req.content, req.mime_type
        )
        return {"document_id": result.get("id"), "status": "uploaded"}
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.get("/onboarding/broker-documents/{account_id}")
async def list_broker_documents(account_id: str) -> list[dict[str, Any]]:
    """List documents uploaded for a brokerage account."""
    _require_broker_api()

    try:
        return await _broker_api.list_documents(account_id)
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


# ─── ACH / Bank Linking ─────────────────────────────────────────────


@router.post("/onboarding/ach-relationship/{account_id}")
async def create_ach_relationship(account_id: str, req: AchRelationshipRequest) -> dict[str, Any]:
    """Create an ACH bank relationship using a Plaid processor token."""
    _require_broker_api()

    try:
        result = await _broker_api.create_ach_relationship(
            account_id, processor_token=req.processor_token
        )
        return {
            "relationship_id": result.get("id"),
            "status": result.get("status"),
            "bank_name": result.get("bank_name"),
            "account_type": result.get("account_owner_name"),
        }
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.get("/onboarding/ach-relationships/{account_id}")
async def list_ach_relationships(account_id: str) -> list[dict[str, Any]]:
    """List ACH relationships for a brokerage account."""
    _require_broker_api()

    try:
        return await _broker_api.list_ach_relationships(account_id)
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.delete("/onboarding/ach-relationship/{account_id}/{relationship_id}")
async def delete_ach_relationship(account_id: str, relationship_id: str) -> dict[str, str]:
    """Delete an ACH relationship."""
    _require_broker_api()

    try:
        await _broker_api.delete_ach_relationship(account_id, relationship_id)
        return {"status": "deleted"}
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


# ─── Transfers ───────────────────────────────────────────────────────


@router.post("/onboarding/transfer/{account_id}")
async def create_transfer(account_id: str, req: TransferRequest) -> dict[str, Any]:
    """Initiate an ACH transfer (deposit or withdrawal)."""
    _require_broker_api()

    try:
        result = await _broker_api.create_transfer(
            account_id,
            relationship_id=req.relationship_id,
            amount=req.amount,
            direction=req.direction,
        )
        return {
            "transfer_id": result.get("id"),
            "status": result.get("status"),
            "amount": result.get("amount"),
            "direction": result.get("direction"),
        }
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.get("/onboarding/transfers/{account_id}")
async def list_transfers(account_id: str) -> list[dict[str, Any]]:
    """List transfers for a brokerage account."""
    _require_broker_api()

    try:
        return await _broker_api.list_transfers(account_id)
    except AlpacaBrokerAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
