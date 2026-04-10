"""OpenTelemetry setup for the Sentinel engine.

Opt-in via ``OTEL_ENABLED=true``.  By default traces are printed to the
console (``ConsoleSpanExporter``).  Set ``OTEL_EXPORTER_OTLP_ENDPOINT`` to
switch to the OTLP exporter for production collectors.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opentelemetry.trace import Tracer

logger = logging.getLogger(__name__)

_SERVICE_NAME = "sentinel-engine"


def _otel_enabled() -> bool:
    return os.getenv("OTEL_ENABLED", "false").lower() in ("true", "1", "yes")


@lru_cache(maxsize=1)
def _init_tracing() -> None:
    """Initialise the global TracerProvider (called once)."""
    if not _otel_enabled():
        logger.warning(
            "OpenTelemetry is disabled (OTEL_ENABLED is not set). "
            "Set OTEL_ENABLED=true for production observability."
        )
        return

    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

    resource = Resource.create({"service.name": _SERVICE_NAME})
    provider = TracerProvider(resource=resource)

    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if otlp_endpoint:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
            OTLPSpanExporter,
        )

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint)))
        logger.info("OTLP exporter configured → %s", otlp_endpoint)
    else:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        logger.info("Console span exporter active (set OTEL_EXPORTER_OTLP_ENDPOINT for OTLP)")

    trace.set_tracer_provider(provider)


def get_tracer(name: str = _SERVICE_NAME) -> Tracer:
    """Return a tracer, initialising the provider on first call.

    When OTEL is disabled, the returned tracer is the no-op default from the
    ``opentelemetry-api`` package, so call-sites don't need guards.
    If the package isn't installed at all, returns a lightweight no-op stub.
    """
    _init_tracing()

    try:
        from opentelemetry import trace

        return trace.get_tracer(name)
    except ModuleNotFoundError:
        return _NoOpTracer()  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Minimal no-op fallback when opentelemetry-api is not installed
# ---------------------------------------------------------------------------


class _NoOpSpan:
    """Span that does nothing — used when OTel is not installed."""

    def set_attribute(self, key: str, value) -> None:
        pass

    def is_recording(self) -> bool:
        return False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class _NoOpTracer:
    """Tracer that returns no-op spans — used when OTel is not installed."""

    def start_as_current_span(self, name: str, **kwargs):
        return _NoOpSpan()


def instrument_fastapi(app) -> None:
    """Instrument a FastAPI application if OTEL is enabled."""
    if not _otel_enabled():
        return

    _init_tracing()

    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumented with OpenTelemetry")
    except ModuleNotFoundError:
        logger.warning("OTEL_ENABLED=true but opentelemetry packages are not installed")
