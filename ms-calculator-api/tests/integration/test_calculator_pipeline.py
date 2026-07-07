"""Integration test: pipeline contract — byte-identical vs golden output."""

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


class FakePublisher:
    def __init__(self) -> None:
        self.computed = None
        self.failed = None

    async def publish_computed(self, payload: object) -> None:
        self.computed = payload

    async def publish_failed(self, payload: object) -> None:
        self.failed = payload


@pytest.fixture
def frozen_clock() -> MagicMock:
    clock = MagicMock()
    clock.now_utc.return_value = FROZEN_NOW
    return clock


class TestCalculatorPipelineContract:
    """The pipeline output must be byte-identical to the golden fixture."""

    async def test_output_matches_golden_fixture(self, frozen_clock: MagicMock) -> None:
        """Running the pipeline against T014 produces output identical to T015."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        fixture = json.loads(FIXTURE_INPUT.read_text())
        golden = json.loads(FIXTURE_GOLDEN.read_text())

        pub = FakePublisher()
        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=pub,
            clock=frozen_clock,
        )
        payload = SimulationOutputPayload.model_validate(fixture)
        await svc.execute(payload)

        assert pub.computed is not None, "Expected computed payload, got None"
        result = pub.computed

        # Compare field by field
        assert result.simulationId == golden["simulationId"]
        assert result.seriesCount == golden["seriesCount"]
        assert result.eventsCount == golden["eventsCount"]
        assert result.providerName == golden["providerName"]
        assert result.computedAt == golden["computedAt"]

        # Compare timeSeries structure (parameterId x locationId pairs)
        result_pairs = {
            (ts["header"]["locationId"], ts["header"]["parameterId"]) for ts in result.timeSeries
        }
        golden_pairs = {
            (ts["header"]["locationId"], ts["header"]["parameterId"]) for ts in golden["timeSeries"]
        }
        assert result_pairs == golden_pairs, (
            f"TimeSeries mismatch.\nResult:  {sorted(result_pairs)}\nGolden: {sorted(golden_pairs)}"
        )

    async def test_output_series_count_is_12(self, frozen_clock: MagicMock) -> None:
        """2 reservoirs x 6 columns = 12 balance series."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        fixture = json.loads(FIXTURE_INPUT.read_text())
        pub = FakePublisher()
        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=pub,
            clock=frozen_clock,
        )
        payload = SimulationOutputPayload.model_validate(fixture)
        await svc.execute(payload)

        assert pub.computed is not None
        assert pub.computed.seriesCount == 12

    async def test_all_events_have_date_time_value_flag(self, frozen_clock: MagicMock) -> None:
        """Every event in the output has date, time, value, flag fields."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        fixture = json.loads(FIXTURE_INPUT.read_text())
        pub = FakePublisher()
        svc = CalculatorService(
            config_path=TEST_CONFIG,
            publisher=pub,
            clock=frozen_clock,
        )
        payload = SimulationOutputPayload.model_validate(fixture)
        await svc.execute(payload)

        assert pub.computed is not None
        for ts in pub.computed.timeSeries:
            for event in ts["events"]:
                assert "date" in event
                assert "time" in event
                assert "value" in event
                assert "flag" in event
