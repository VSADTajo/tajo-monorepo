"""CalculatorService — orchestrates the volume-balance pipeline from an AMQP payload."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import structlog

from src.api.schemas.balance_output import BalanceComputedPayload, BalanceFailedPayload
from src.api.schemas.simulation_input import SimulationOutputPayload
from src.application.ports import BalanceEventPublisherPort, ClockPort
from src.infrastructure.payload_source import AmqpPayloadSource

logger = structlog.get_logger()


class SystemClock:
    """Real-time clock adapter."""

    def now_utc(self) -> datetime:
        return datetime.now(tz=UTC)


def run_pipeline_from_payload(
    config: Any,
    payload_dict: dict[str, Any],
    pipeline: str = "harmonie",
) -> Any:
    """Run the volume_calculator pipeline on an in-memory payload dict.

    This helper mirrors ``run_reservoir_pipeline`` but skips ``load_signal_payloads``
    and uses the provided payload dict as the single in-memory data source for all
    signals.  All signal routing (q.in.for.harmonie, eps, q.out.for, v.obs) is done by
    ``find_optional_time_series`` over this single combined payload.

    Args:
        config: The loaded reservoir config mapping (from ``load_reservoir_config``).
        payload_dict: A ``{"timeSeries": [...]}`` dict produced by ``AmqpPayloadSource``.
        pipeline: ``"harmonie"`` or ``"eps"``.

    Returns:
        A ``ReservoirPipelineResult`` dataclass.
    """
    from src.domain.volume_calculator.reservoir_timeseries import (
        ReservoirPipelineResult,
        add_accumulated_forecast_columns,
        add_forecast_balance_columns,
        events_to_pandas_series,
        find_observed_volume_at_t0,
        find_optional_time_series,
        resolve_configured_reservoirs,
        resolve_forecast_t0,
        resolve_pipeline_forecast_signals,
        resolve_signal_parameter_id,
        signal_to_column_name,
    )

    try:
        import pandas as pd
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError("pandas is required") from exc

    # Use all reservoirs configured in the test config
    normalized_reservoirs = resolve_configured_reservoirs(config)

    # The single in-memory "source" — a list containing one payload dict
    in_memory_payloads = [payload_dict]

    # ── Build observed-volume DataFrame ──────────────────────────────────────
    obs_frames: list[Any] = []
    for reservoir_id in normalized_reservoirs:
        parameter_id = resolve_signal_parameter_id(config, reservoir_id, "v.obs")
        series_payload = find_optional_time_series(in_memory_payloads, reservoir_id, parameter_id)
        if series_payload is None:
            signal_frame = pd.DataFrame(
                {
                    "reservoir": pd.Series(dtype="object"),
                    "timestamp": pd.Series(dtype="datetime64[ns, UTC]"),
                    "v.obs": pd.Series(dtype="float64"),
                }
            )
        else:
            series = events_to_pandas_series(
                series_payload,
                name=f"{reservoir_id}:v.obs",
            )
            signal_frame = series.rename("v.obs").rename_axis("timestamp").reset_index()
            signal_frame.insert(0, "reservoir", reservoir_id)
        obs_frames.append(signal_frame)

    if obs_frames:
        observed_volume = (
            pd.concat(obs_frames, ignore_index=True)
            .sort_values(["reservoir", "timestamp"])
            .reset_index(drop=True)
        )
    else:
        observed_volume = pd.DataFrame(columns=["reservoir", "timestamp", "v.obs"])

    # ── Determine forecast signals for this pipeline ──────────────────────────
    forecast_signals = resolve_pipeline_forecast_signals(config, normalized_reservoirs, pipeline)

    # ── Build forecast DataFrame ───────────────────────────────────────────────
    forecast_frames: list[Any] = []
    for reservoir_id in normalized_reservoirs:
        reservoir_frame: Any = None
        for signal in forecast_signals:
            parameter_id = resolve_signal_parameter_id(config, reservoir_id, signal)
            series_payload = find_optional_time_series(
                in_memory_payloads, reservoir_id, parameter_id
            )
            value_column = signal_to_column_name(signal)
            if series_payload is None:
                signal_frame = pd.DataFrame(
                    {
                        "reservoir": pd.Series(dtype="object"),
                        "timestamp": pd.Series(dtype="datetime64[ns, UTC]"),
                        value_column: pd.Series(dtype="float64"),
                    }
                )
            else:
                series = events_to_pandas_series(
                    series_payload,
                    name=f"{reservoir_id}:{signal}",
                )
                signal_frame = series.rename(value_column).rename_axis("timestamp").reset_index()
                signal_frame.insert(0, "reservoir", reservoir_id)

            if reservoir_frame is None:
                reservoir_frame = signal_frame
            else:
                reservoir_frame = pd.merge(
                    reservoir_frame,
                    signal_frame,
                    on=["reservoir", "timestamp"],
                    how="outer",
                )

        if reservoir_frame is not None:
            forecast_frames.append(reservoir_frame)

    value_columns = [signal_to_column_name(s) for s in forecast_signals]
    if forecast_frames:
        forecast = (
            pd.concat(forecast_frames, ignore_index=True)
            .sort_values(["reservoir", "timestamp"])
            .reset_index(drop=True)
        )
    else:
        forecast = pd.DataFrame(columns=["reservoir", "timestamp", *value_columns])

    forecast = add_accumulated_forecast_columns(forecast, forecast_signals)
    t0 = resolve_forecast_t0(forecast)  # type: ignore[no-untyped-call]
    observed_volume_at_t0 = find_observed_volume_at_t0(
        observed_volume,
        normalized_reservoirs,
        t0,
    )
    forecast = add_forecast_balance_columns(forecast, forecast_signals, observed_volume_at_t0)

    return ReservoirPipelineResult(
        pipeline=pipeline,
        observed_volume=observed_volume,
        forecast=forecast,
        forecast_signals=forecast_signals,
        t0=t0,
        observed_volume_at_t0=observed_volume_at_t0,
    )


class CalculatorService:
    """Orchestrates the volume-balance pipeline end-to-end.

    Consumes a ``SimulationOutputPayload``, runs the ported pipeline twice
    (harmonie + eps), merges the results, and either publishes the computed
    payload or a failure event via the injected publisher.
    """

    def __init__(
        self,
        config_path: Path,
        publisher: BalanceEventPublisherPort,
        clock: ClockPort,
    ) -> None:
        self._config_path = config_path
        self._publisher = publisher
        self._clock = clock

        # Load config once at construction time
        from src.domain.volume_calculator.reservoir_timeseries import load_reservoir_config

        self._config = load_reservoir_config(config_path)

    async def execute(self, payload: SimulationOutputPayload) -> None:
        """Consume a payload, compute balances, and publish the result event."""
        import structlog

        structlog.contextvars.bind_contextvars(simulation_id=payload.simulationId)
        start_time = time.monotonic()
        try:
            result = await self._compute(payload)
            if result is None:
                return
            await self._publisher.publish_computed(result)
            duration_ms = int((time.monotonic() - start_time) * 1000)
            logger.info(
                "publisher.event_sent",
                message="Balance computed event published",
                routing_key="simulation.manual.balance.computed",
                message_size=len(result.model_dump_json()),
                duration_ms=duration_ms,
            )
        except (ValueError, KeyError, TypeError) as exc:
            logger.warning(
                "calculation.failed",
                message=str(exc),
                error_type="config_error",
            )
            await self._publisher.publish_failed(
                BalanceFailedPayload(
                    simulationId=payload.simulationId,
                    reason=str(exc),
                    errorType="config_error",
                    retryable=False,
                    occurredAt=self._clock.now_utc().isoformat(),
                )
            )
        finally:
            structlog.contextvars.clear_contextvars()

    async def compute(self, payload: SimulationOutputPayload) -> BalanceComputedPayload:
        """Compute the balance payload and return it directly (no publishing).

        Used by POST /calculate and can be reused by execute().
        Raises ValueError for invalid payloads, re-raises unexpected exceptions.
        """
        if not payload.timeSeries:
            raise ValueError("timeSeries is empty or missing")

        logger.info(
            "calculation.started",
            message="Starting balance calculation",
            reservoir_count=self._count_reservoirs(payload),
            simulation_id=payload.simulationId,
        )

        source = AmqpPayloadSource(payload)
        pipeline_payload = source.to_pipeline_payload()

        from src.domain.volume_calculator.reservoir_timeseries import (
            build_balance_time_series_payload,
        )

        # Run harmonie pipeline
        try:
            harmonie_result = run_pipeline_from_payload(
                self._config, pipeline_payload, pipeline="harmonie"
            )
        except Exception as exc:
            logger.warning(
                "calculation.pipeline_failed",
                message=f"Harmonie pipeline failed: {exc}",
                pipeline="harmonie",
            )
            harmonie_result = None

        # Run EPS pipeline
        try:
            eps_result = run_pipeline_from_payload(self._config, pipeline_payload, pipeline="eps")
        except Exception as exc:
            logger.warning(
                "calculation.pipeline_failed",
                message=f"EPS pipeline failed: {exc}",
                pipeline="eps",
            )
            eps_result = None

        if harmonie_result is None and eps_result is None:
            raise ValueError("Both harmonie and EPS pipelines failed — no resolvable reservoirs")

        # Check if we actually got any balance series
        has_harmonie_series = harmonie_result is not None and not harmonie_result.forecast.empty
        has_eps_series = eps_result is not None and not eps_result.forecast.empty
        if not has_harmonie_series and not has_eps_series:
            raise ValueError(
                "No balance series could be computed — all reservoirs may be missing config "
                "or the input payload has no matching data"
            )

        # Build output payload from available results
        now = self._clock.now_utc()

        if harmonie_result is not None and eps_result is not None:
            # Merge: EPS result already has q.out.for, add harmonie balance columns
            harmonie_ts = build_balance_time_series_payload(harmonie_result, created_at=now)
            eps_ts = build_balance_time_series_payload(eps_result, created_at=now)
            # Combine both timeSeries lists
            merged_ts = harmonie_ts.get("timeSeries", []) + eps_ts.get("timeSeries", [])
        elif harmonie_result is not None:
            harmonie_ts = build_balance_time_series_payload(harmonie_result, created_at=now)
            merged_ts = harmonie_ts.get("timeSeries", [])
        else:
            # eps_result is not None here (we checked above)
            eps_ts = build_balance_time_series_payload(eps_result, created_at=now)
            merged_ts = eps_ts.get("timeSeries", [])

        total_events = sum(len(ts.get("events", [])) for ts in merged_ts)

        computed = BalanceComputedPayload(
            simulationId=payload.simulationId,
            providerName="volume-calculator",
            seriesCount=len(merged_ts),
            eventsCount=total_events,
            computedAt=now.isoformat(),
            timeSeries=merged_ts,
        )

        logger.info(
            "calculation.completed",
            message="Balance calculation complete",
            output_series_count=len(merged_ts),
        )
        return computed

    async def publish_failed_from_raw(
        self,
        simulation_id: str,
        reason: str,
        error_type: str,
    ) -> None:
        """Publish a BalanceFailedPayload for a failure identified outside the normal pipeline.

        Encapsulates direct access to the publisher and clock so callers (e.g., the AMQP
        consumer) do not need to reach into private attributes.

        Args:
            simulation_id: Identifier of the simulation that failed.
            reason: Human-readable description of the failure.
            error_type: One of "invalid_payload", "config_error", "computation_error",
                "publish_error".
        """
        await self._publisher.publish_failed(
            BalanceFailedPayload(
                simulationId=simulation_id,
                reason=reason,
                errorType=error_type,
                retryable=False,
                occurredAt=self._clock.now_utc().isoformat(),
            )
        )

    async def _compute(self, payload: SimulationOutputPayload) -> BalanceComputedPayload | None:
        """Internal compute with error handling that publishes failure events."""
        if not payload.timeSeries:
            await self._publisher.publish_failed(
                BalanceFailedPayload(
                    simulationId=payload.simulationId,
                    reason="timeSeries is empty or missing",
                    errorType="invalid_payload",
                    retryable=False,
                    occurredAt=self._clock.now_utc().isoformat(),
                )
            )
            return None

        try:
            return await self.compute(payload)
        except ValueError as exc:
            await self._publisher.publish_failed(
                BalanceFailedPayload(
                    simulationId=payload.simulationId,
                    reason=str(exc),
                    errorType="config_error",
                    retryable=False,
                    occurredAt=self._clock.now_utc().isoformat(),
                )
            )
            return None

    def _count_reservoirs(self, payload: SimulationOutputPayload) -> int:
        """Count distinct reservoirs in the payload."""
        return len({entry.header.locationId for entry in payload.timeSeries})
