"""Tests for src/infrastructure/logging/structlog_config.py."""

from __future__ import annotations

import json


class TestConfigureLogging:
    """configure_logging() installs structlog with JSON output."""

    def test_json_output_to_stdout(self, capsys: object) -> None:
        """configure_logging() must produce JSON lines on stdout."""
        from src.infrastructure.logging.structlog_config import configure_logging, get_logger

        configure_logging(level="debug")
        log = get_logger()
        log.info("test.event", message="hello")
        captured = capsys.readouterr()  # type: ignore[attr-defined]
        # At least one non-empty line
        lines = [ln for ln in captured.out.splitlines() if ln.strip()]
        assert len(lines) >= 1, "Expected at least one JSON log line on stdout"
        parsed = json.loads(lines[-1])
        assert isinstance(parsed, dict)

    def test_log_line_has_required_fields(self, capsys: object) -> None:
        """Every log line has ts, level, service, event, message."""
        from src.infrastructure.logging.structlog_config import configure_logging, get_logger

        configure_logging(level="debug")
        log = get_logger()
        log.info("test.fields", message="checking fields")
        captured = capsys.readouterr()  # type: ignore[attr-defined]
        lines = [ln for ln in captured.out.splitlines() if ln.strip()]
        assert lines, "Expected JSON output"
        parsed = json.loads(lines[-1])
        assert "ts" in parsed, "Missing 'ts' field"
        assert "level" in parsed, "Missing 'level' field"
        assert "service" in parsed, "Missing 'service' field"
        assert parsed["service"] == "ms-calculator-api"
        assert "event" in parsed, "Missing 'event' field"

    def test_bind_contextvars_adds_simulation_id(self, capsys: object) -> None:
        """After bind_contextvars(simulation_id=...), subsequent logs include it."""
        import structlog

        from src.infrastructure.logging.structlog_config import configure_logging, get_logger

        configure_logging(level="debug")
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(simulation_id="test-sim-id-123")
        log = get_logger()
        log.info("test.with_context", message="bound context")
        captured = capsys.readouterr()  # type: ignore[attr-defined]
        lines = [ln for ln in captured.out.splitlines() if ln.strip()]
        assert lines
        parsed = json.loads(lines[-1])
        assert parsed.get("simulation_id") == "test-sim-id-123"

    def test_clear_contextvars_removes_simulation_id(self, capsys: object) -> None:
        """clear_contextvars() removes simulation_id from subsequent logs."""
        import structlog

        from src.infrastructure.logging.structlog_config import configure_logging, get_logger

        configure_logging(level="debug")
        structlog.contextvars.bind_contextvars(simulation_id="will-be-cleared")
        structlog.contextvars.clear_contextvars()
        log = get_logger()
        log.info("test.after_clear", message="context cleared")
        captured = capsys.readouterr()  # type: ignore[attr-defined]
        lines = [ln for ln in captured.out.splitlines() if ln.strip()]
        assert lines
        parsed = json.loads(lines[-1])
        assert "simulation_id" not in parsed or parsed.get("simulation_id") is None
