"""Tests that request correlation ID middleware injects and propagates IDs."""

import re

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_correlation_id_added_to_response():
    """Every response must include an X-Correlation-ID header."""
    response = client.get("/health")
    assert "x-correlation-id" in response.headers


def test_existing_correlation_id_propagated():
    """If X-Correlation-ID is sent in request, same ID is echoed back."""
    headers = {"X-Correlation-ID": "test-id-12345"}
    response = client.get("/health", headers=headers)
    assert response.headers.get("x-correlation-id") == "test-id-12345"


def test_missing_correlation_id_generates_uuid():
    """If no ID is provided, a valid UUID is generated."""
    response = client.get("/health")
    correlation_id = response.headers.get("x-correlation-id", "")
    uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    assert re.match(uuid_pattern, correlation_id), f"Not a valid UUID: {correlation_id}"
