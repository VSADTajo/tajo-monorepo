"""Fire-and-forget HTTP shipper for structlog logs → ms-logs-api.

Mirror of the NestJS `pino-logs-api-transport` in `tajo-toolkit`. Ships every
non-debug structlog record to `POST {LOGS_API_URL}/api/logs` so ms-logs-api
persists it in MongoDB, enabling end-to-end tracing by `correlationId`.

The shipper is fire-and-forget: HTTP is dispatched to a small thread pool and
failures never propagate to the caller. If ms-logs-api is unreachable the app
keeps running and errors are written to stderr for observability.
"""

from __future__ import annotations

import atexit
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

_SKIP_LEVELS = {"debug", "notset", "trace"}

# Structlog / stdlib metadata keys the collector already represents as top-level
# fields — moving them to `meta` would be redundant.
_RESERVED_META_KEYS = {
    "level",
    "ts",
    "timestamp",
    "service",
    "logger",
    "event",
    "message",
    "exception",
    "stack_info",
    # stdlib LogRecord injected by structlog.stdlib.ProcessorFormatter.wrap_for_formatter
    "_record",
    "_from_structlog",
}


def _sanitize_meta_value(value: Any) -> Any:
    """Ensure a single meta value is JSON-serializable, falling back to str()."""
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def build_collector_payload(
    event_dict: dict[str, Any],
    service_name: str,
) -> dict[str, Any] | None:
    """Map a structlog event_dict to the ms-logs-api payload shape.

    Returns None when the log must be skipped (debug/trace level, or explicitly
    marked via `skip_shipping=True`).

    Invariants (mirroring `tajo-toolkit/pino-logs-api-transport.ts`):
    - `entity` = `source` = service name (never a route-derived value).
    - `correlationId` = `simulation_id` (business ID) or `trace_id` (technical).
    - `meta` carries everything else app-specific.
    """
    if event_dict.get("skip_shipping"):
        return None

    level = str(event_dict.get("level", "info")).lower()
    if level in _SKIP_LEVELS:
        return None
    # ms-logs-api schema accepts 'warning' (not 'warn')
    if level == "warn":
        level = "warning"
    # Anything unexpected defaults to 'info' so the collector never rejects it
    if level not in {"info", "warning", "error"}:
        level = "info"

    message = event_dict.get("event") or event_dict.get("message") or ""

    correlation_id = (
        event_dict.get("simulation_id")
        or event_dict.get("trace_id")
        or event_dict.get("correlationId")
        or event_dict.get("correlation_id")
    )
    if correlation_id is not None:
        correlation_id = str(correlation_id)

    meta = {
        key: _sanitize_meta_value(value)
        for key, value in event_dict.items()
        if key not in _RESERVED_META_KEYS and key != "skip_shipping"
    }

    return {
        "level": level,
        "entity": service_name,
        "message": str(message),
        "source": service_name,
        "correlationId": correlation_id,
        "meta": meta,
    }


class LogsApiShipper:
    """HTTP fire-and-forget shipper backed by a thread pool.

    Sync interface (compatible with structlog processor chain, which is sync)
    but the actual POST happens off-thread so it never blocks the caller.
    """

    def __init__(
        self,
        url: str,
        service_name: str,
        api_key: str = "",
        timeout_seconds: float = 5.0,
        max_workers: int = 2,
    ) -> None:
        self._url = url.rstrip("/") + "/api/logs"
        self._service_name = service_name
        self._headers: dict[str, str] = {"content-type": "application/json"}
        if api_key:
            self._headers["x-api-key"] = api_key
        self._client = httpx.Client(timeout=timeout_seconds)
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="logs-api-shipper",
        )
        atexit.register(self.close)

    @property
    def service_name(self) -> str:
        return self._service_name

    def close(self) -> None:
        try:
            self._executor.shutdown(wait=False, cancel_futures=True)
        except Exception:
            pass
        try:
            self._client.close()
        except Exception:
            pass

    def ship(self, payload: dict[str, Any]) -> None:
        try:
            self._executor.submit(self._do_ship, payload)
        except RuntimeError:
            # Executor already shut down (app is stopping) — silently drop
            pass

    def _do_ship(self, payload: dict[str, Any]) -> None:
        try:
            self._client.post(self._url, json=payload, headers=self._headers)
        except Exception as err:
            # Fire-and-forget: never let logging errors crash the app
            sys.stderr.write(
                f"[logs-api-shipper] failed to ship log: {err}\n"
            )


def make_logs_api_processor(shipper: LogsApiShipper):
    """Return a structlog processor that ships every record to ms-logs-api.

    The processor is a pure pass-through: it never mutates the event_dict, it
    just fires an off-thread HTTP POST as a side effect. Structlog will still
    render the JSON to stdout as before.
    """

    service_name = shipper.service_name

    def processor(_logger, _method_name, event_dict):
        payload = build_collector_payload(event_dict, service_name)
        if payload is not None:
            shipper.ship(payload)
        return event_dict

    return processor
