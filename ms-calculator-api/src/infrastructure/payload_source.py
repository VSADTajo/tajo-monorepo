"""Adapter: SimulationOutputPayload → pipeline-compatible payload dict."""

from __future__ import annotations

from typing import Any

from src.api.schemas.simulation_input import SimulationOutputPayload


class AmqpPayloadSource:
    """Convert an AMQP payload to the dict shape the volume_calculator pipeline expects.

    The pipeline's ``find_optional_time_series`` expects a list of payloads where
    each payload has a ``timeSeries`` key containing a list of series dicts with
    ``header`` and ``events`` keys.  This adapter wraps the pydantic model into
    that exact shape — without modifying the domain package.
    """

    def __init__(self, payload: SimulationOutputPayload) -> None:
        self._payload = payload

    def to_pipeline_payload(self) -> dict[str, Any]:
        """Return a ``{"timeSeries": [...]}`` dict compatible with the pipeline."""
        time_series: list[dict[str, Any]] = []

        for entry in self._payload.timeSeries:
            # Serialize header — use model_dump to include extra fields
            header_dict: dict[str, Any] = entry.header.model_dump(exclude_none=False)
            # Remove None values for cleaner pipeline input; keep missVal even if default
            header_dict = {k: v for k, v in header_dict.items() if v is not None}

            events_list: list[dict[str, Any]] = [
                ev.model_dump(exclude_none=False) for ev in entry.events
            ]

            time_series.append(
                {
                    "header": header_dict,
                    "events": events_list,
                }
            )

        return {"timeSeries": time_series}
