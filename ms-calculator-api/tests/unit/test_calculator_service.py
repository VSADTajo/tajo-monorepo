"""Tests for CalculatorService — orchestration with mocked publisher."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest

FIXTURE_INPUT = Path(__file__).parent.parent / "fixtures" / "simulation_output_e08_e09.json"
FIXTURE_GOLDEN = Path(__file__).parent.parent / "fixtures" / "expected_balance_output.json"
TEST_CONFIG = Path(__file__).parent.parent / "fixtures" / "reservoir_parameters_test.json"
FROZEN_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)


def make_frozen_clock() -> MagicMock:
    clock = MagicMock()
    clock.now_utc.return_value = FROZEN_NOW
    return clock


class FakeBalanceEventPublisher:
    """In-memory publisher capturing calls for assertion."""

    def __init__(self) -> None:
        self.computed_calls: list = []
        self.failed_calls: list = []

    async def publish_computed(self, payload: object) -> None:
        self.computed_calls.append(payload)

    async def publish_failed(self, payload: object) -> None:
        self.failed_calls.append(payload)


@pytest.fixture
def fixture_payload() -> dict:
    return json.loads(FIXTURE_INPUT.read_text())


@pytest.fixture
def golden_output() -> dict:
    return json.loads(FIXTURE_GOLDEN.read_text())


@pytest.fixture
def publisher() -> FakeBalanceEventPublisher:
    return FakeBalanceEventPublisher()


@pytest.fixture
def service(publisher: FakeBalanceEventPublisher) -> object:
    from src.application.calculator_service import CalculatorService

    return CalculatorService(
        config_path=TEST_CONFIG,
        publisher=publisher,
        clock=make_frozen_clock(),
    )


class TestCalculatorServiceExecute:
    """execute() calls the publisher with the correct result."""

    async def test_execute_calls_publish_computed_once(
        self,
        service: object,
        publisher: FakeBalanceEventPublisher,
        fixture_payload: dict,
    ) -> None:
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        svc: CalculatorService = service  # type: ignore[assignment]
        payload = SimulationOutputPayload.model_validate(fixture_payload)
        await svc.execute(payload)

        assert len(publisher.computed_calls) == 1
        assert len(publisher.failed_calls) == 0

    async def test_execute_result_has_6_balance_series_per_reservoir(
        self,
        service: object,
        publisher: FakeBalanceEventPublisher,
        fixture_payload: dict,
    ) -> None:
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        svc: CalculatorService = service  # type: ignore[assignment]
        payload = SimulationOutputPayload.model_validate(fixture_payload)
        await svc.execute(payload)

        result = publisher.computed_calls[0]
        # 2 reservoirs x 6 columns = 12
        assert result.seriesCount == 12
        parameter_ids = {ts["header"]["parameterId"] for ts in result.timeSeries}
        assert "v.balance.q.in.for.harmonie" in parameter_ids
        # Check EPS balances
        for pct in ("10", "25", "50", "75", "90"):
            assert f"v.balance.q.in.for.eps.{pct}" in parameter_ids

    async def test_execute_publishes_failed_when_no_resolvable_reservoirs(
        self,
        publisher: FakeBalanceEventPublisher,
    ) -> None:
        """When input has zero reservoirs resolvable in config, publish_failed is called."""
        from src.api.schemas.simulation_input import (
            SimulationOutputPayload,
            TimeSeriesEntry,
            TimeSeriesEvent,
            TimeSeriesHeader,
        )
        from src.application.calculator_service import CalculatorService

        # Payload with a reservoir NOT in test config
        payload = SimulationOutputPayload(
            simulationId="no-reservoir-sim",
            providerName="manual-simulation",
            timeSeries=[
                TimeSeriesEntry(
                    header=TimeSeriesHeader(
                        locationId="Z_99",
                        parameterId="some.param",
                        sourceTimezone="UTC",
                    ),
                    events=[
                        TimeSeriesEvent(date="2024-01-01", time="00:00:00", value="1.0", flag="2")
                    ],
                )
            ],
        )
        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=publisher,
            clock=make_frozen_clock(),
        )
        await svc.execute(payload)

        assert len(publisher.failed_calls) == 1
        assert len(publisher.computed_calls) == 0
        failed = publisher.failed_calls[0]
        assert "config" in failed.errorType.lower() or "error" in failed.errorType.lower()

    async def test_execute_publishes_failed_when_timeseries_empty(
        self,
        publisher: FakeBalanceEventPublisher,
    ) -> None:
        """When timeSeries is empty, publish_failed is called with invalid_payload."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        payload = SimulationOutputPayload(
            simulationId="empty-series-sim",
            providerName="manual-simulation",
            timeSeries=[],
        )
        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=publisher,
            clock=make_frozen_clock(),
        )
        await svc.execute(payload)

        assert len(publisher.failed_calls) == 1
        assert publisher.failed_calls[0].errorType == "invalid_payload"
        assert len(publisher.computed_calls) == 0

    async def test_simulation_id_cleared_after_execute(
        self,
        service: object,
        publisher: FakeBalanceEventPublisher,
        fixture_payload: dict,
    ) -> None:
        """simulation_id contextvars is cleared after execute() returns."""
        import structlog

        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        svc: CalculatorService = service  # type: ignore[assignment]
        payload = SimulationOutputPayload.model_validate(fixture_payload)
        structlog.contextvars.clear_contextvars()
        await svc.execute(payload)
        # After execute, context should be cleared
        ctx = structlog.contextvars.get_contextvars()
        assert "simulation_id" not in ctx


class TestPublishFailedFromRaw:
    """publish_failed_from_raw() publishes a BalanceFailedPayload via the publisher."""

    @pytest.mark.parametrize(
        "error_type",
        ["invalid_payload", "config_error", "computation_error", "publish_error"],
    )
    async def test_publishes_failed_payload_with_correct_fields(
        self,
        publisher: FakeBalanceEventPublisher,
        error_type: str,
    ) -> None:
        """publish_failed_from_raw delegates to publisher.publish_failed with correct payload."""
        from src.application.calculator_service import CalculatorService

        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=publisher,
            clock=make_frozen_clock(),
        )

        await svc.publish_failed_from_raw(
            simulation_id="sim-abc-123",
            reason="Something went wrong",
            error_type=error_type,
        )

        assert len(publisher.failed_calls) == 1
        assert len(publisher.computed_calls) == 0
        failed = publisher.failed_calls[0]
        assert failed.simulationId == "sim-abc-123"
        assert failed.reason == "Something went wrong"
        assert failed.errorType == error_type
        assert failed.retryable is False
        assert failed.occurredAt == FROZEN_NOW.isoformat()

    async def test_does_not_call_private_publisher_directly(
        self,
        publisher: FakeBalanceEventPublisher,
    ) -> None:
        """publish_failed_from_raw must not require accessing private attributes."""
        from src.application.calculator_service import CalculatorService

        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=publisher,
            clock=make_frozen_clock(),
        )

        # Verify the method exists and is public (no leading underscore)
        assert hasattr(svc, "publish_failed_from_raw")
        assert callable(svc.publish_failed_from_raw)

        await svc.publish_failed_from_raw(
            simulation_id="sim-xyz",
            reason="Payload validation failed",
            error_type="invalid_payload",
        )
        assert len(publisher.failed_calls) == 1
