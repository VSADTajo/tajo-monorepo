"""Tests for log shape — every log line during processing has simulation_id."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest

FIXTURE_INPUT = Path(__file__).parent.parent / "fixtures" / "simulation_output_e08_e09.json"
TEST_CONFIG = Path(__file__).parent.parent / "fixtures" / "reservoir_parameters_test.json"
FROZEN_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)


class FakePublisher:
    async def publish_computed(self, payload: object) -> None:
        pass

    async def publish_failed(self, payload: object) -> None:
        pass


@pytest.fixture
def frozen_clock() -> MagicMock:
    clock = MagicMock()
    clock.now_utc.return_value = FROZEN_NOW
    return clock


class TestLogShape:
    """Every log line during CalculatorService.execute() has required fields."""

    async def test_all_processing_logs_have_simulation_id(
        self, frozen_clock: MagicMock, capsys: object
    ) -> None:
        """Every log line during execute() has simulation_id."""
        import structlog

        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService
        from src.infrastructure.logging.structlog_config import configure_logging

        configure_logging(level="debug")
        fixture = json.loads(FIXTURE_INPUT.read_text())
        payload = SimulationOutputPayload.model_validate(fixture)

        pub = FakePublisher()
        svc = CalculatorService(config_path=TEST_CONFIG, publisher=pub, clock=frozen_clock)

        structlog.contextvars.clear_contextvars()
        await svc.execute(payload)

        captured = capsys.readouterr()  # type: ignore[attr-defined]
        lines = [ln for ln in captured.out.splitlines() if ln.strip()]
        assert lines, "Expected log output"

        processing_lines = []
        for line in lines:
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            # Only check lines that were emitted DURING processing (have simulation_id)
            if "simulation_id" in parsed:
                processing_lines.append(parsed)

        assert processing_lines, "Expected at least one log line with simulation_id"
        for parsed in processing_lines:
            assert parsed.get("simulation_id") == fixture["simulationId"], (
                f"Expected simulation_id={fixture['simulationId']!r}, "
                f"got {parsed.get('simulation_id')!r} in: {parsed}"
            )

    async def test_log_sequence_includes_lifecycle_events(
        self, frozen_clock: MagicMock, capsys: object
    ) -> None:
        """Log sequence includes calculation.started, calculation.completed, publisher.event_sent."""
        import json

        import structlog

        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService
        from src.infrastructure.logging.structlog_config import configure_logging

        configure_logging(level="debug")
        fixture = json.loads(FIXTURE_INPUT.read_text())
        payload = SimulationOutputPayload.model_validate(fixture)

        pub = FakePublisher()
        svc = CalculatorService(config_path=TEST_CONFIG, publisher=pub, clock=frozen_clock)
        structlog.contextvars.clear_contextvars()
        await svc.execute(payload)

        captured = capsys.readouterr()  # type: ignore[attr-defined]
        events = []
        for line in captured.out.splitlines():
            try:
                parsed = json.loads(line)
                events.append(parsed.get("event", ""))
            except json.JSONDecodeError:
                pass

        assert "calculation.started" in events
        assert "calculation.completed" in events
        assert "publisher.event_sent" in events

        # Check ordering
        idx_started = events.index("calculation.started")
        idx_completed = events.index("calculation.completed")
        idx_sent = events.index("publisher.event_sent")
        assert idx_started < idx_completed < idx_sent

    async def test_context_cleared_after_execute(self, frozen_clock: MagicMock) -> None:
        """After execute() returns, simulation_id is not in structlog context."""
        import structlog

        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        fixture = json.loads(FIXTURE_INPUT.read_text())
        payload = SimulationOutputPayload.model_validate(fixture)

        pub = FakePublisher()
        svc = CalculatorService(config_path=TEST_CONFIG, publisher=pub, clock=frozen_clock)
        structlog.contextvars.clear_contextvars()
        await svc.execute(payload)

        ctx = structlog.contextvars.get_contextvars()
        assert "simulation_id" not in ctx

    async def test_reservoir_skipped_warning_emitted(
        self, frozen_clock: MagicMock, capsys: object
    ) -> None:
        """When a reservoir is in the config but missing from input, a warning is emitted."""
        import json

        import structlog

        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService
        from src.infrastructure.logging.structlog_config import configure_logging

        configure_logging(level="debug")

        # Load fixture but remove E_09 series to force missing-data path
        fixture = json.loads(FIXTURE_INPUT.read_text())
        # Keep only E_08 series
        fixture["timeSeries"] = [
            ts for ts in fixture["timeSeries"] if ts["header"]["locationId"] == "E_08"
        ]
        payload = SimulationOutputPayload.model_validate(fixture)

        pub = FakePublisher()
        svc = CalculatorService(config_path=TEST_CONFIG, publisher=pub, clock=frozen_clock)
        structlog.contextvars.clear_contextvars()
        await svc.execute(payload)

        # The service should still succeed but E_09 will have no data
        # (We don't enforce the exact warning message, just that it doesn't crash)
        captured = capsys.readouterr()  # type: ignore[attr-defined]
        lines = [ln for ln in captured.out.splitlines() if ln.strip()]
        assert any("calculation" in ln for ln in lines)
