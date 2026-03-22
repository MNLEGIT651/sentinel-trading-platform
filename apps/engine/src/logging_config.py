"""Structured logging configuration for production."""

import json
import logging
import sys
from datetime import datetime
from typing import Any

from src.middleware.tracing import request_id_context


class JSONFormatter(logging.Formatter):
    """Format logs as JSON for easy parsing by log aggregation services."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_context.get(""),
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add any extra fields from record.__dict__
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
                "exc_info",
                "exc_text",
                "stack_info",
                "request_id",
            ]:
                log_data[key] = value

        return json.dumps(log_data)


def configure_logging(level: str = "INFO") -> logging.Logger:
    """Configure logging with JSON formatter.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Returns:
        Root logger configured for production use
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler with JSON formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper()))
    console_handler.setFormatter(JSONFormatter())

    root_logger.addHandler(console_handler)

    # Suppress noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)


class StructuredLogger:
    """Wrapper for structured logging with consistent format."""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    def info(self, message: str, **extra: Any) -> None:
        """Log info level with structured data."""
        self.logger.info(message, extra=extra)

    def error(self, message: str, **extra: Any) -> None:
        """Log error level with structured data."""
        self.logger.error(message, extra=extra)

    def warning(self, message: str, **extra: Any) -> None:
        """Log warning level with structured data."""
        self.logger.warning(message, extra=extra)

    def debug(self, message: str, **extra: Any) -> None:
        """Log debug level with structured data."""
        self.logger.debug(message, extra=extra)
