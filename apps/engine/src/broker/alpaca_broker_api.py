"""Alpaca Broker API client for account creation, KYC, and funding.

This module is separate from the Trading API client in execution/alpaca_broker.py.
The Broker API manages the regulated account lifecycle:
  - Account creation with KYC data
  - Document upload for identity verification
  - Account status polling
  - ACH relationship management
  - Transfer initiation

All PII is sent directly to Alpaca — we never persist KYC data locally.
"""

from __future__ import annotations

import logging
from base64 import b64encode
from typing import Any

import httpx

from src.config import Settings

logger = logging.getLogger(__name__)


class AlpacaBrokerAPIError(Exception):
    """Raised when Alpaca Broker API returns an error."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Alpaca Broker API error {status_code}: {detail}")


class AlpacaBrokerAPI:
    """Client for Alpaca Broker API v1.

    Authenticates with Basic auth using broker API key + secret.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        s = settings or Settings()
        self._base_url = s.alpaca_broker_api_url.rstrip("/")
        self._key = s.alpaca_broker_api_key
        self._secret = s.alpaca_broker_api_secret

    @property
    def is_configured(self) -> bool:
        return bool(self._key and self._secret)

    def _auth_header(self) -> dict[str, str]:
        creds = b64encode(f"{self._key}:{self._secret}".encode()).decode()
        return {"Authorization": f"Basic {creds}"}

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        headers = {**self._auth_header(), "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, json=json_body, params=params)

        if resp.status_code >= 400:
            detail = resp.text[:500]
            logger.error(
                "Alpaca Broker API %s %s → %s: %s",
                method,
                path,
                resp.status_code,
                detail,
            )
            raise AlpacaBrokerAPIError(resp.status_code, detail)

        if resp.status_code == 204:
            return {}
        return resp.json()  # type: ignore[no-any-return]

    # ─── Account Creation ────────────────────────────────────────────

    async def create_account(self, application: dict[str, Any]) -> dict[str, Any]:
        """Submit a new account application with KYC data.

        ``application`` should follow the Alpaca Account model:
        https://docs.alpaca.markets/docs/create-an-account

        Returns the created account object (status may not be ACTIVE yet).
        """
        return await self._request("POST", "/v1/accounts", json_body=application)

    async def get_account(self, account_id: str) -> dict[str, Any]:
        """Get account details by Alpaca account ID."""
        return await self._request("GET", f"/v1/accounts/{account_id}")

    async def list_accounts(self, *, query: str | None = None) -> list[dict[str, Any]]:
        """List accounts, optionally filtered."""
        params = {}
        if query:
            params["query"] = query
        result = await self._request("GET", "/v1/accounts", params=params)
        return result if isinstance(result, list) else [result]

    # ─── Documents ───────────────────────────────────────────────────

    async def upload_document(
        self,
        account_id: str,
        document_type: str,
        content: str,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        """Upload an identity document for KYC verification.

        ``document_type``: identity_verification, address_verification, etc.
        ``content``: base64-encoded file content.
        """
        return await self._request(
            "POST",
            f"/v1/accounts/{account_id}/documents/upload",
            json_body={
                "document_type": document_type,
                "content": content,
                "mime_type": mime_type,
            },
        )

    async def list_documents(self, account_id: str) -> list[dict[str, Any]]:
        """List documents uploaded for an account."""
        result = await self._request("GET", f"/v1/accounts/{account_id}/documents")
        return result if isinstance(result, list) else [result]

    # ─── ACH Relationships ───────────────────────────────────────────

    async def create_ach_relationship(
        self,
        account_id: str,
        *,
        processor_token: str,
    ) -> dict[str, Any]:
        """Create an ACH relationship using a Plaid processor token.

        The processor token is obtained by exchanging a Plaid public_token
        for a processor_token via Plaid's /processor/token/create endpoint.
        """
        return await self._request(
            "POST",
            f"/v1/accounts/{account_id}/ach_relationships",
            json_body={"processor_token": processor_token},
        )

    async def list_ach_relationships(self, account_id: str) -> list[dict[str, Any]]:
        """List ACH relationships for an account."""
        result = await self._request("GET", f"/v1/accounts/{account_id}/ach_relationships")
        return result if isinstance(result, list) else [result]

    async def delete_ach_relationship(
        self, account_id: str, relationship_id: str
    ) -> dict[str, Any]:
        """Delete an ACH relationship."""
        return await self._request(
            "DELETE",
            f"/v1/accounts/{account_id}/ach_relationships/{relationship_id}",
        )

    # ─── Transfers ───────────────────────────────────────────────────

    async def create_transfer(
        self,
        account_id: str,
        *,
        relationship_id: str,
        amount: str,
        direction: str,
    ) -> dict[str, Any]:
        """Initiate an ACH transfer (deposit or withdrawal).

        ``direction``: INCOMING (deposit) or OUTGOING (withdrawal).
        ``amount``: string representation of the amount (e.g. "1000.00").
        """
        return await self._request(
            "POST",
            f"/v1/accounts/{account_id}/transfers",
            json_body={
                "transfer_type": "ach",
                "relationship_id": relationship_id,
                "amount": amount,
                "direction": direction,
            },
        )

    async def list_transfers(self, account_id: str) -> list[dict[str, Any]]:
        """List transfers for an account."""
        result = await self._request("GET", f"/v1/accounts/{account_id}/transfers")
        return result if isinstance(result, list) else [result]

    async def get_transfer(self, account_id: str, transfer_id: str) -> dict[str, Any]:
        """Get transfer details."""
        return await self._request("GET", f"/v1/accounts/{account_id}/transfers/{transfer_id}")
