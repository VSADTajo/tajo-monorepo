"""Structlog configuration — JSON renderer with contextvars support.

By default every log line is emitted as JSON to stdout. When ``logs_api_url``
is provided, records are also fire-and-forget shipped to ms-logs-api so they
are persisted in MongoDB for end-to-end tracing by ``simulation_id``.
"""

from __future__ import annotations

import logging
import sys

import structlog

from src.infrastructure.logging.logs_api_transport import (
    LogsApiShipper,
    make_logs_api_processor,
)

_SERVICE_NAME = "ms-calculator-api"


def configure_logging(
    level: str = "info",
    logs_api_url: str = "",
    logs_api_key: str = "",
) -> None:
    """Install structlog processors and configure stdlib logging.

    After calling this, every structlog logger emits a single JSON object per
    line to stdout, with mandatory fields: ts, level, service, event.
    ``simulation_id`` is injected automatically when bound via
    ``structlog.contextvars.bind_contextvars``.

    Args:
        level: log level ("debug", "info", "warning", "error"). Below-info
            records are still rendered to stdout but NOT shipped to
            ms-logs-api (matches the tajo-toolkit convention).
        logs_api_url: base URL of ms-logs-api (e.g. ``http://ms-logs-api:3004``).
            When empty, shipping is disabled — logs only go to stdout.
        logs_api_key: value for the ``x-api-key`` header.
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Configure stdlib logging to go to stdout only
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True, key="ts"),
        _add_service_constant,  # type: ignore[list-item]
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    # Insert the ms-logs-api shipper BEFORE the JSON renderer so it sees the
    # fully enriched event_dict (with ts, service, contextvars, etc).
    if logs_api_url:
        shipper = LogsApiShipper(
            url=logs_api_url,
            service_name=_SERVICE_NAME,
            api_key=logs_api_key,
        )
        shared_processors.append(make_logs_api_processor(shipper))

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    # Remove existing handlers to avoid duplicate lines
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)


def get_logger(name: str = _SERVICE_NAME) -> structlog.stdlib.BoundLogger:
    """Return a structlog bound logger."""
    return structlog.get_logger(name)  # type: ignore[no-any-return]


def _add_service_constant(
    logger: object,
    method_name: str,
    event_dict: dict[str, object],
) -> dict[str, object]:
    """Always inject service=ms-calculator-api into every log entry."""
    event_dict.setdefault("service", _SERVICE_NAME)
    return event_dict
