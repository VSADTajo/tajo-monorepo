"""Tests for AmqpPayloadSource — SimulationOutputPayload → pipeline dict adapter."""

from __future__ import annotations

import json
from pathlib import Path

FIXTURE_PATH = Path(__file__).parent.parent / "fixtures" / "simulation_output_e08_e09.json"


def load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text())


class TestAmqpPayloadSource:
    """AmqpPayloadSource converts pydantic models to pipeline-compatible dicts."""

    def test_extraction_preserves_headers_verbatim(self) -> None:
        """Header fields from the input are passed unchanged to the pipeline dict."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.infrastructure.payload_source import AmqpPayloadSource

        fixture = load_fixture()
        payload = SimulationOutputPayload.model_validate(fixture)
        source = AmqpPayloadSource(payload)
        pipeline = source.to_pipeline_payload()

        assert "timeSeries" in pipeline
        ts = pipeline["timeSeries"]
        assert len(ts) == len(fixture["timeSeries"])

        # Check first entry's header
        first_input_header = fixture["timeSeries"][0]["header"]
        first_output_header = ts[0]["header"]
        assert first_output_header["locationId"] == first_input_header["locationId"]
        assert first_output_header["parameterId"] == first_input_header["parameterId"]

    def test_extraction_preserves_events_verbatim(self) -> None:
        """Events from the input are passed unchanged to the pipeline dict."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.infrastructure.payload_source import AmqpPayloadSource

        fixture = load_fixture()
        payload = SimulationOutputPayload.model_validate(fixture)
        source = AmqpPayloadSource(payload)
        pipeline = source.to_pipeline_payload()

        # Check events in first series
        first_input_events = fixture["timeSeries"][0]["events"]
        first_output_events = pipeline["timeSeries"][0]["events"]
        assert len(first_output_events) == len(first_input_events)
        assert first_output_events[0]["date"] == first_input_events[0]["date"]
        assert first_output_events[0]["time"] == first_input_events[0]["time"]
        assert first_output_events[0]["value"] == first_input_events[0]["value"]

    def test_extraction_handles_empty_timeseries(self) -> None:
        """Empty timeSeries list produces an empty pipeline payload."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.infrastructure.payload_source import AmqpPayloadSource

        payload = SimulationOutputPayload(
            simulationId="test-empty",
            providerName="manual-simulation",
            timeSeries=[],
        )
        source = AmqpPayloadSource(payload)
        pipeline = source.to_pipeline_payload()

        assert pipeline["timeSeries"] == []

    def test_pipeline_payload_is_list_of_dicts(self) -> None:
        """Each timeSeries entry is a plain dict, not a pydantic model."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.infrastructure.payload_source import AmqpPayloadSource

        fixture = load_fixture()
        payload = SimulationOutputPayload.model_validate(fixture)
        source = AmqpPayloadSource(payload)
        pipeline = source.to_pipeline_payload()

        for entry in pipeline["timeSeries"]:
            assert isinstance(entry, dict)
            assert isinstance(entry["header"], dict)
            assert isinstance(entry["events"], list)

    def test_all_series_present_in_output(self) -> None:
        """The adapter outputs all time series from the fixture."""
        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.infrastructure.payload_source import AmqpPayloadSource

        fixture = load_fixture()
        payload = SimulationOutputPayload.model_validate(fixture)
        source = AmqpPayloadSource(payload)
        pipeline = source.to_pipeline_payload()

        pairs_in = {
            (ts["header"]["locationId"], ts["header"]["parameterId"])
            for ts in fixture["timeSeries"]
        }
        pairs_out = {
            (ts["header"]["locationId"], ts["header"]["parameterId"])
            for ts in pipeline["timeSeries"]
        }
        assert pairs_out == pairs_in
