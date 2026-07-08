"""Unit tests for the ms-logs-api HTTP shipper."""

from __future__ import annotations

import time
from typing import Any

import pytest

from src.infrastructure.logging.logs_api_transport import (
    LogsApiShipper,
    build_collector_payload,
    make_logs_api_processor,
)

SERVICE = "ms-calculator-api"


class TestBuildCollectorPayload:
    def test_returns_expected_shape_for_info_log(self):
        payload = build_collector_payload(
            {
                "level": "info",
                "event": "pipeline.completed",
                "ts": "2026-07-08T14:00:00Z",
                "service": SERVICE,
                "simulation_id": "abc-123",
                "seriesCount": 12,
            },
            SERVICE,
        )
        assert payload == {
            "level": "info",
            "entity": SERVICE,
            "message": "pipeline.completed",
            "source": SERVICE,
            "correlationId": "abc-123",
            "meta": {"simulation_id": "abc-123", "seriesCount": 12},
        }

    def test_skips_debug_level(self):
        assert build_collector_payload(
            {"level": "debug", "event": "trace"}, SERVICE
        ) is None

    def test_skips_trace_level(self):
        assert build_collector_payload(
            {"level": "trace", "event": "very verbose"}, SERVICE
        ) is None

    def test_skips_when_explicit_flag(self):
        assert build_collector_payload(
            {"level": "info", "event": "internal", "skip_shipping": True},
            SERVICE,
        ) is None

    def test_warn_is_normalized_to_warning(self):
        payload = build_collector_payload(
            {"level": "warn", "event": "queue.slow"}, SERVICE
        )
        assert payload is not None
        assert payload["level"] == "warning"

    def test_unknown_level_falls_back_to_info(self):
        payload = build_collector_payload(
            {"level": "critical", "event": "something.bad"}, SERVICE
        )
        assert payload is not None
        assert payload["level"] == "info"

    def test_correlation_id_prefers_simulation_id_over_trace_id(self):
        payload = build_collector_payload(
            {
                "level": "info",
                "event": "e",
                "simulation_id": "sim-1",
                "trace_id": "trace-9",
            },
            SERVICE,
        )
        assert payload is not None
        assert payload["correlationId"] == "sim-1"

    def test_correlation_id_falls_back_to_trace_id(self):
        payload = build_collector_payload(
            {"level": "info", "event": "e", "trace_id": "trace-9"}, SERVICE
        )
        assert payload is not None
        assert payload["correlationId"] == "trace-9"

    def test_correlation_id_null_when_absent(self):
        payload = build_collector_payload(
            {"level": "info", "event": "e"}, SERVICE
        )
        assert payload is not None
        assert payload["correlationId"] is None

    def test_meta_excludes_reserved_keys(self):
        payload = build_collector_payload(
            {
                "level": "info",
                "event": "e",
                "ts": "2026-07-08T14:00:00Z",
                "service": SERVICE,
                "logger": "src.foo",
                "message": "duplicate",
                "custom_field": 42,
            },
            SERVICE,
        )
        assert payload is not None
        assert "level" not in payload["meta"]
        assert "ts" not in payload["meta"]
        assert "service" not in payload["meta"]
        assert "logger" not in payload["meta"]
        assert "event" not in payload["meta"]
        assert "message" not in payload["meta"]
        assert payload["meta"]["custom_field"] == 42

    def test_uses_event_as_message(self):
        payload = build_collector_payload(
            {"level": "error", "event": "publish.failed"}, SERVICE
        )
        assert payload is not None
        assert payload["message"] == "publish.failed"

    def test_falls_back_to_message_field_when_event_absent(self):
        payload = build_collector_payload(
            {"level": "error", "message": "boom"}, SERVICE
        )
        assert payload is not None
        assert payload["message"] == "boom"


class _FakeHttpxClient:
    def __init__(self, raise_on_post: Exception | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._raise = raise_on_post

    def post(self, url: str, json: dict, headers: dict):
        self.calls.append({"url": url, "json": json, "headers": headers})
        if self._raise is not None:
            raise self._raise

    def close(self) -> None:
        pass


def _make_shipper(monkeypatch: pytest.MonkeyPatch, fake_client: _FakeHttpxClient) -> LogsApiShipper:
    import src.infrastructure.logging.logs_api_transport as mod

    monkeypatch.setattr(mod.httpx, "Client", lambda **kwargs: fake_client)
    return LogsApiShipper(
        url="http://ms-logs-api:3004",
        service_name=SERVICE,
        api_key="secret",
    )


class TestLogsApiShipper:
    def test_ship_posts_to_api_logs_endpoint(self, monkeypatch):
        fake = _FakeHttpxClient()
        shipper = _make_shipper(monkeypatch, fake)
        shipper.ship({"level": "info", "message": "hello"})
        # Wait for background thread to flush
        time.sleep(0.15)
        assert len(fake.calls) == 1
        call = fake.calls[0]
        assert call["url"] == "http://ms-logs-api:3004/api/logs"
        assert call["json"] == {"level": "info", "message": "hello"}
        assert call["headers"].get("x-api-key") == "secret"
        assert call["headers"].get("content-type") == "application/json"
        shipper.close()

    def test_ship_without_api_key_omits_header(self, monkeypatch):
        fake = _FakeHttpxClient()
        import src.infrastructure.logging.logs_api_transport as mod

        monkeypatch.setattr(mod.httpx, "Client", lambda **kwargs: fake)
        shipper = LogsApiShipper(
            url="http://ms-logs-api:3004",
            service_name=SERVICE,
        )
        shipper.ship({"level": "info", "message": "hello"})
        time.sleep(0.15)
        assert len(fake.calls) == 1
        assert "x-api-key" not in fake.calls[0]["headers"]
        shipper.close()

    def test_ship_swallows_http_errors(self, monkeypatch):
        fake = _FakeHttpxClient(raise_on_post=RuntimeError("collector down"))
        shipper = _make_shipper(monkeypatch, fake)
        # Should not raise
        shipper.ship({"level": "error", "message": "boom"})
        time.sleep(0.15)
        assert len(fake.calls) == 1
        shipper.close()


class TestMakeLogsApiProcessor:
    def test_processor_calls_ship_and_returns_event_dict_unchanged(self, monkeypatch):
        fake = _FakeHttpxClient()
        shipper = _make_shipper(monkeypatch, fake)
        processor = make_logs_api_processor(shipper)

        event_dict = {
            "level": "info",
            "event": "pipeline.completed",
            "simulation_id": "abc-123",
        }
        # Structlog invokes processors with (logger, method_name, event_dict)
        result = processor(None, "info", event_dict)

        # Event dict is returned unchanged so downstream renderer works
        assert result is event_dict

        time.sleep(0.15)
        assert len(fake.calls) == 1
        assert fake.calls[0]["json"]["correlationId"] == "abc-123"
        assert fake.calls[0]["json"]["entity"] == SERVICE
        assert fake.calls[0]["json"]["source"] == SERVICE
        shipper.close()

    def test_processor_skips_debug_records(self, monkeypatch):
        fake = _FakeHttpxClient()
        shipper = _make_shipper(monkeypatch, fake)
        processor = make_logs_api_processor(shipper)

        result = processor(None, "debug", {"level": "debug", "event": "trace"})
        assert result == {"level": "debug", "event": "trace"}

        time.sleep(0.15)
        assert fake.calls == []
        shipper.close()
