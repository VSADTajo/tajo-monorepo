"""Build pandas dataframes with reservoir time-series signals."""

from __future__ import annotations

import argparse
import glob
import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pytz

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = Path("config/reservoir_parameters.json")
TEST_RESERVOIRS = ("E_08", "E_09")
PIPELINE_CHOICES = ("harmonie", "eps")
Q_OUT_SIGNAL = "q.out.for"
HARMONIE_FORECAST_SIGNALS = (Q_OUT_SIGNAL, "q.in.for.harmonie")
FORECAST_SIGNALS = HARMONIE_FORECAST_SIGNALS
OBSERVED_VOLUME_SIGNALS = ("v.obs",)
WISKI_ENCODINGS = ("utf-8-sig", "cp1252", "latin-1")
WISKI_LOCATION_ID_KEY = "Número de la estación"
WISKI_PARAMETER_ID_KEY = "Nombre de la serie temporal"
M3_TO_HM3 = 1 / 1_000_000
JSON_MISS_VALUE = "-999.0"
JSON_VALID_FLAG = "2"
JSON_MISSING_FLAG = "8"
BALANCE_JSON_VERSION = "1.34"
BALANCE_JSON_TIME_ZONE = "0.0"
BALANCE_UNITS = "hm3"
WISKI_HEADER_FIELDS = {
    "Ubicación de la estación",
    "Nombre de la estación",
    WISKI_LOCATION_ID_KEY,
    "LocalX",
    "LocalY",
    "Dato",
    "Nombre del parámetro",
    "Tipo de parámetro",
    "Nombre del tipo de parámetro",
    WISKI_PARAMETER_ID_KEY,
    "Unidad de la serie temporal",
    "GlobalX",
    "GlobalY",
    "Longitud",
    "Latitud",
}


class ReservoirConfigurationError(ValueError):
    """Raised when the reservoir configuration cannot resolve a requested signal."""


class ReservoirDataError(ValueError):
    """Raised when the requested reservoir time series cannot be found or parsed."""


@dataclass(frozen=True)
class ReservoirPipelineResult:
    """DataFrames generated for one reservoir execution pipeline."""

    pipeline: str
    observed_volume: Any
    forecast: Any
    forecast_signals: tuple[str, ...]
    t0: Any
    observed_volume_at_t0: Any


def load_reservoir_config(config_path: str | Path) -> Mapping[str, Any]:
    """Load the reservoir configuration JSON."""
    path = resolve_config_path(config_path)
    with path.open(encoding="utf-8") as source:
        config = json.load(source)

    if not isinstance(config, Mapping):
        raise ReservoirConfigurationError("Expected the config root to be an object.")

    return config


def resolve_config_path(config_path: str | Path) -> Path:
    """Resolve the config path from cwd or from the project root."""
    return _resolve_existing_file(config_path, "reservoir configuration")


def normalize_reservoir_id(reservoir_id: str) -> str:
    """Normalize ids like ``E08`` to the JSON/config form ``E_08``."""
    normalized = reservoir_id.strip()
    match = re.fullmatch(r"E_?(\d+)", normalized, flags=re.IGNORECASE)
    if not match:
        return normalized

    return f"E_{int(match.group(1)):02d}"


def resolve_configured_reservoirs(config: Mapping[str, Any]) -> tuple[str, ...]:
    """Return all reservoir ids configured in source order."""
    reservoirs = _required_mapping(config, "reservoirs", "config")
    return tuple(normalize_reservoir_id(str(reservoir)) for reservoir in reservoirs)


def resolve_requested_reservoirs(
    config: Mapping[str, Any],
    reservoirs: Sequence[str] | None = None,
) -> tuple[str, ...]:
    """Return requested reservoirs, or every configured reservoir when omitted."""
    if not reservoirs:
        return resolve_configured_reservoirs(config)

    return tuple(normalize_reservoir_id(reservoir) for reservoir in reservoirs)


def build_reservoir_signal_dataframe(
    config_path: str | Path,
    reservoirs: Sequence[str] | None,
    signals: Sequence[str],
    base_path: str | Path | None = None,
):
    """Return a pandas DataFrame with one row per reservoir timestamp.

    For the reduced test harmonie use case, call it with
    ``reservoirs=TEST_RESERVOIRS`` and
    ``signals=("q.out.for", "q.in.for.harmonie")``.
    The resulting columns are ``reservoir``, ``timestamp`` and one value column per
    signal, for example ``q.in.for.harmonie``.
    """
    pd = _import_pandas()
    config_file = resolve_config_path(config_path)
    root = Path(base_path) if base_path is not None else config_file.parent.parent
    config = load_reservoir_config(config_file)
    normalized_reservoirs = resolve_requested_reservoirs(config, reservoirs)
    value_columns = [signal_to_column_name(signal) for signal in signals]
    if len(value_columns) != len(set(value_columns)):
        raise ReservoirConfigurationError(
            f"Signal column names must be unique; got {value_columns!r}."
        )

    payload_cache: dict[str, list[Mapping[str, Any]]] = {}
    reservoir_frames = []

    for reservoir_id in normalized_reservoirs:
        reservoir_frame = None

        for signal in signals:
            parameter_id = resolve_signal_parameter_id(config, reservoir_id, signal)
            source_key, source = resolve_signal_data_source(config, signal)
            payloads = payload_cache.setdefault(
                source_key,
                load_signal_payloads(root, source),
            )
            value_column = signal_to_column_name(signal)
            series_payload = find_optional_time_series(payloads, reservoir_id, parameter_id)
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
            reservoir_frames.append(reservoir_frame)

    if not reservoir_frames:
        return pd.DataFrame(columns=["reservoir", "timestamp", *value_columns])

    return (
        pd.concat(reservoir_frames, ignore_index=True)
        .sort_values(["reservoir", "timestamp"])
        .reset_index(drop=True)
    )


def build_forecast_dataframe(
    config_path: str | Path = DEFAULT_CONFIG_PATH,
    reservoirs: Sequence[str] | None = None,
    base_path: str | Path | None = None,
):
    """Return the simplified harmonie forecast DataFrame."""
    dataframe = build_reservoir_signal_dataframe(
        config_path,
        reservoirs=reservoirs,
        signals=FORECAST_SIGNALS,
        base_path=base_path,
    )
    return add_accumulated_forecast_columns(dataframe, FORECAST_SIGNALS)


def build_observed_volume_dataframe(
    config_path: str | Path = DEFAULT_CONFIG_PATH,
    reservoirs: Sequence[str] | None = None,
    base_path: str | Path | None = None,
):
    """Return the observed-volume DataFrame with the value column ``v.obs``."""
    return build_reservoir_signal_dataframe(
        config_path,
        reservoirs=reservoirs,
        signals=OBSERVED_VOLUME_SIGNALS,
        base_path=base_path,
    )


def build_pipeline_forecast_dataframe(
    config_path: str | Path = DEFAULT_CONFIG_PATH,
    reservoirs: Sequence[str] | None = None,
    pipeline: str = "harmonie",
    base_path: str | Path | None = None,
):
    """Return the forecast DataFrame for the selected execution pipeline."""
    config_file = resolve_config_path(config_path)
    config = load_reservoir_config(config_file)
    normalized_reservoirs = resolve_requested_reservoirs(config, reservoirs)
    signals = resolve_pipeline_forecast_signals(config, normalized_reservoirs, pipeline)
    dataframe = build_reservoir_signal_dataframe(
        config_file,
        reservoirs=normalized_reservoirs,
        signals=signals,
        base_path=base_path,
    )
    return add_accumulated_forecast_columns(dataframe, signals)


def run_reservoir_pipeline(
    config_path: str | Path = DEFAULT_CONFIG_PATH,
    reservoirs: Sequence[str] | None = None,
    pipeline: str = "harmonie",
    base_path: str | Path | None = None,
) -> ReservoirPipelineResult:
    """Build the observed-volume and forecast DataFrames for one pipeline."""
    config_file = resolve_config_path(config_path)
    root = Path(base_path) if base_path is not None else config_file.parent.parent
    config = load_reservoir_config(config_file)
    normalized_reservoirs = resolve_requested_reservoirs(config, reservoirs)
    forecast_signals = resolve_pipeline_forecast_signals(
        config,
        normalized_reservoirs,
        pipeline,
    )
    observed_volume = build_observed_volume_dataframe(
        config_file,
        reservoirs=normalized_reservoirs,
        base_path=root,
    )
    forecast = build_reservoir_signal_dataframe(
        config_file,
        reservoirs=normalized_reservoirs,
        signals=forecast_signals,
        base_path=root,
    )
    forecast = add_accumulated_forecast_columns(forecast, forecast_signals)
    t0 = resolve_forecast_t0(forecast)
    observed_volume_at_t0 = find_observed_volume_at_t0(
        observed_volume,
        normalized_reservoirs,
        t0,
    )
    forecast = add_forecast_balance_columns(
        forecast,
        forecast_signals,
        observed_volume_at_t0,
    )

    return ReservoirPipelineResult(
        pipeline=pipeline,
        observed_volume=observed_volume,
        forecast=forecast,
        forecast_signals=forecast_signals,
        t0=t0,
        observed_volume_at_t0=observed_volume_at_t0,
    )


def resolve_forecast_t0(forecast):
    """Return the first timestamp of the forecast DataFrame."""
    pd = _import_pandas()
    if forecast.empty or "timestamp" not in forecast.columns:
        return pd.NaT

    return forecast["timestamp"].min()


def find_observed_volume_at_t0(observed_volume, reservoirs: Sequence[str], t0):
    """Return observed volume at t0, or the nearest value, for each reservoir."""
    pd = _import_pandas()
    columns = ["reservoir", "t0", "v.obs.t0", "v.obs.timestamp", "v.obs.time_delta"]
    if observed_volume.empty or pd.isna(t0):
        return pd.DataFrame(
            [
                {
                    "reservoir": reservoir,
                    "t0": t0,
                    "v.obs.t0": pd.NA,
                    "v.obs.timestamp": pd.NaT,
                    "v.obs.time_delta": pd.NaT - pd.NaT,
                }
                for reservoir in reservoirs
            ],
            columns=columns,
        )

    rows = []
    for reservoir in reservoirs:
        reservoir_frame = observed_volume[
            (observed_volume["reservoir"] == reservoir) & observed_volume["v.obs"].notna()
        ].sort_values("timestamp")
        if reservoir_frame.empty:
            rows.append(
                {
                    "reservoir": reservoir,
                    "t0": t0,
                    "v.obs.t0": pd.NA,
                    "v.obs.timestamp": pd.NaT,
                    "v.obs.time_delta": pd.NaT - pd.NaT,
                }
            )
            continue

        nearest_index = (reservoir_frame["timestamp"] - t0).abs().idxmin()
        nearest = reservoir_frame.loc[nearest_index]
        rows.append(
            {
                "reservoir": reservoir,
                "t0": t0,
                "v.obs.t0": nearest["v.obs"],
                "v.obs.timestamp": nearest["timestamp"],
                "v.obs.time_delta": nearest["timestamp"] - t0,
            }
        )

    return pd.DataFrame(rows, columns=columns)


def add_accumulated_forecast_columns(forecast, forecast_signals: Sequence[str]):
    """Add cumulative hm3 columns per reservoir from m3/s forecast signals."""
    pd = _import_pandas()
    dataframe = forecast.copy()
    accumulated_columns = [
        signal_to_accumulated_column_name(signal_to_column_name(signal))
        for signal in forecast_signals
    ]
    if dataframe.empty:
        for column in accumulated_columns:
            dataframe[column] = pd.Series(dtype="float64")
        return dataframe

    dataframe = dataframe.sort_values(["reservoir", "timestamp"]).reset_index(drop=True)
    for signal in forecast_signals:
        value_column = signal_to_column_name(signal)
        accumulated_column = signal_to_accumulated_column_name(value_column)
        if value_column not in dataframe.columns:
            dataframe[accumulated_column] = pd.Series(dtype="float64")
            continue

        dataframe[accumulated_column] = pd.Series(index=dataframe.index, dtype="float64")
        for _, reservoir_frame in dataframe.groupby("reservoir", sort=False):
            dataframe.loc[reservoir_frame.index, accumulated_column] = _accumulate_flow_as_hm3(
                reservoir_frame[value_column],
                reservoir_frame["timestamp"],
            )

    return dataframe


def _accumulate_flow_as_hm3(flow, timestamps):
    """Integrate m3/s values into cumulative hm3 from the first timestamp."""
    if not flow.notna().any():
        return flow

    elapsed_seconds = timestamps.diff().dt.total_seconds().fillna(0)
    increments = flow.fillna(0).astype(float) * elapsed_seconds * M3_TO_HM3
    return increments.cumsum()


def add_forecast_balance_columns(
    forecast,
    forecast_signals: Sequence[str],
    observed_volume_at_t0,
):
    """Add volume-balance columns using observed volume at t0 and accumulated flows."""
    pd = _import_pandas()
    dataframe = forecast.copy()
    if dataframe.empty or observed_volume_at_t0.empty:
        return dataframe

    q_out_accumulated_column = signal_to_accumulated_column_name(Q_OUT_SIGNAL)
    if q_out_accumulated_column not in dataframe.columns:
        return dataframe

    observed_volume_by_reservoir = observed_volume_at_t0.set_index("reservoir")["v.obs.t0"]
    initial_volume = dataframe["reservoir"].map(observed_volume_by_reservoir)

    for signal in forecast_signals:
        value_column = signal_to_column_name(signal)
        if value_column == Q_OUT_SIGNAL:
            continue

        accumulated_column = signal_to_accumulated_column_name(value_column)
        if accumulated_column not in dataframe.columns:
            continue

        balance_column = signal_to_balance_column_name(value_column)
        balance = (
            initial_volume + dataframe[accumulated_column] - dataframe[q_out_accumulated_column]
        )
        dataframe[balance_column] = pd.to_numeric(balance, errors="coerce").clip(lower=0)

    return dataframe


def signal_to_accumulated_column_name(signal: str) -> str:
    """Return the cumulative column name for a signal column."""
    return f"{signal}.accumulated"


def signal_to_balance_column_name(signal: str) -> str:
    """Return the volume-balance column name for an input-flow signal."""
    return f"v.balance.{signal}"


def build_balance_time_series_payload(
    result: ReservoirPipelineResult,
    created_at: Any | None = None,
) -> dict[str, Any]:
    """Return v.balance columns as a FEWS-like timeSeries JSON payload."""
    return balance_dataframe_to_time_series_payload(
        result.forecast,
        forecast_date=result.t0,
        created_at=created_at,
    )


def balance_dataframe_to_time_series_payload(
    forecast,
    forecast_date: Any | None = None,
    created_at: Any | None = None,
) -> dict[str, Any]:
    """Convert forecast v.balance columns to the input JSON timeSeries format."""
    pd = _import_pandas()
    payload: dict[str, Any] = {
        "version": BALANCE_JSON_VERSION,
        "timeZone": BALANCE_JSON_TIME_ZONE,
        "timeSeries": [],
    }
    if forecast.empty:
        return payload

    balance_columns = [
        column for column in forecast.columns if str(column).startswith("v.balance.")
    ]
    if not balance_columns:
        return payload

    created_at_timestamp = _as_utc_timestamp(
        created_at if created_at is not None else datetime.now(tz=pytz.UTC)
    )

    for reservoir_id, reservoir_frame in forecast.groupby("reservoir", sort=True):
        reservoir_frame = reservoir_frame.sort_values("timestamp")
        if reservoir_frame.empty:
            continue

        for balance_column in balance_columns:
            if balance_column not in reservoir_frame.columns:
                continue

            timestamps = pd.to_datetime(reservoir_frame["timestamp"])
            start = timestamps.min()
            end = timestamps.max()
            series_forecast_date = forecast_date if forecast_date is not None else start
            payload["timeSeries"].append(
                {
                    "header": _build_balance_time_series_header(
                        reservoir_id=reservoir_id,
                        parameter_id=balance_column,
                        timestamps=timestamps,
                        start=start,
                        end=end,
                        forecast_date=series_forecast_date,
                        created_at=created_at_timestamp,
                    ),
                    "events": _build_balance_time_series_events(
                        reservoir_frame,
                        balance_column,
                    ),
                }
            )

    return payload


def _build_balance_time_series_header(
    reservoir_id: str,
    parameter_id: str,
    timestamps,
    start,
    end,
    forecast_date,
    created_at,
) -> dict[str, Any]:
    return {
        "type": "instantaneous",
        "moduleInstanceId": "volume_calculator",
        "locationId": reservoir_id,
        "parameterId": parameter_id,
        "timeStep": {
            "unit": "second",
            "multiplier": _infer_time_step_seconds(timestamps),
        },
        "startDate": _date_time_dict(start),
        "endDate": _date_time_dict(end),
        "forecastDate": _date_time_dict(forecast_date),
        "missVal": JSON_MISS_VALUE,
        "stationName": reservoir_id,
        "units": BALANCE_UNITS,
        "creationDate": _date_time_dict(created_at)["date"],
        "creationTime": _date_time_dict(created_at)["time"],
        "approvedDate": _date_time_dict(created_at),
    }


def _build_balance_time_series_events(forecast, balance_column: str) -> list[dict[str, str]]:
    pd = _import_pandas()
    events: list[dict[str, str]] = []
    for _, row in forecast.iterrows():
        timestamp = _date_time_dict(row["timestamp"])
        value = row[balance_column]
        is_missing = pd.isna(value)
        events.append(
            {
                "date": timestamp["date"],
                "time": timestamp["time"],
                "value": JSON_MISS_VALUE if is_missing else _format_json_number(value),
                "flag": JSON_MISSING_FLAG if is_missing else JSON_VALID_FLAG,
            }
        )

    return events


def _infer_time_step_seconds(timestamps) -> str:
    pd = _import_pandas()
    ordered = pd.Series(pd.to_datetime(timestamps)).dropna().drop_duplicates().sort_values()
    if len(ordered) < 2:
        return "0"

    deltas = ordered.diff().dropna().dt.total_seconds()
    positive_deltas = deltas[deltas > 0]
    if positive_deltas.empty:
        return "0"

    seconds = positive_deltas.mode().iloc[0]
    return _format_json_number(seconds)


def _date_time_dict(timestamp) -> dict[str, str]:
    utc_timestamp = _as_utc_timestamp(timestamp)
    return {
        "date": utc_timestamp.strftime("%Y-%m-%d"),
        "time": utc_timestamp.strftime("%H:%M:%S"),
    }


def _as_utc_timestamp(timestamp):
    pd = _import_pandas()
    utc_timestamp = pd.Timestamp(timestamp)
    if utc_timestamp.tzinfo is None:
        return utc_timestamp.tz_localize("UTC")

    return utc_timestamp.tz_convert("UTC")


def _format_json_number(value: Any) -> str:
    return format(float(value), ".12g")


def resolve_pipeline_forecast_signals(
    config: Mapping[str, Any],
    reservoirs: Sequence[str],
    pipeline: str,
) -> tuple[str, ...]:
    """Return q.out.for plus the q.in.for signals required by a pipeline."""
    if pipeline == "harmonie":
        return HARMONIE_FORECAST_SIGNALS

    if pipeline == "eps":
        return (Q_OUT_SIGNAL, *resolve_eps_forecast_signals(config, reservoirs))

    raise ReservoirConfigurationError(
        f"Unsupported pipeline {pipeline!r}; expected one of {PIPELINE_CHOICES}."
    )


def resolve_eps_forecast_signals(
    config: Mapping[str, Any],
    reservoirs: Sequence[str],
) -> tuple[str, ...]:
    """Return EPS q.in.for signal names from the selected reservoirs config."""
    normalized_reservoirs = [normalize_reservoir_id(reservoir) for reservoir in reservoirs]
    if not normalized_reservoirs:
        raise ReservoirConfigurationError(
            "At least one reservoir is required to resolve EPS forecast signals."
        )

    reservoirs_config = _required_mapping(config, "reservoirs", "config")
    eps_by_reservoir: dict[str, Mapping[str, Any]] = {}
    percentile_keys: list[str] = []

    for reservoir_id in normalized_reservoirs:
        reservoir = _required_mapping(reservoirs_config, reservoir_id, "reservoirs")
        q_in_for = _required_mapping(
            reservoir,
            "q.in.for",
            f"reservoirs.{reservoir_id}",
        )
        eps = _required_mapping(
            q_in_for,
            "eps",
            f"reservoirs.{reservoir_id}.q.in.for",
        )
        eps_by_reservoir[reservoir_id] = eps
        for percentile, parameter_id in eps.items():
            percentile = str(percentile)
            if (
                isinstance(parameter_id, str)
                and parameter_id.strip()
                and percentile not in percentile_keys
            ):
                percentile_keys.append(percentile)

    if not percentile_keys:
        raise ReservoirConfigurationError(
            "No EPS parameterIds configured for the selected reservoirs."
        )

    for reservoir_id, eps in eps_by_reservoir.items():
        missing = [
            percentile
            for percentile in percentile_keys
            if not isinstance(eps.get(percentile), str) or not eps[percentile].strip()
        ]
        if missing:
            raise ReservoirConfigurationError(
                f"Reservoir {reservoir_id} is missing EPS parameterIds for {missing!r}."
            )

    return tuple(f"q.in.for.eps.{percentile}" for percentile in percentile_keys)


def signal_to_column_name(signal: str) -> str:
    """Return the DataFrame value-column name for a logical signal."""
    return signal


def resolve_signal_data_source(
    config: Mapping[str, Any],
    signal: str,
) -> tuple[str, Mapping[str, Any]]:
    """Return the source configuration for a logical signal."""
    data_sources = _required_mapping(config, "data_sources", "config")

    if signal.startswith("q.in.for."):
        source_name = signal.removeprefix("q.in.for.").split(".", maxsplit=1)[0]
        q_in_for = _required_mapping(data_sources, "q.in.for", "data_sources")
        return f"q.in.for.{source_name}", _required_mapping(
            q_in_for,
            source_name,
            "data_sources.q.in.for",
        )

    return signal, _required_mapping(data_sources, signal, "data_sources")


def resolve_signal_parameter_id(
    config: Mapping[str, Any],
    reservoir_id: str,
    signal: str,
) -> str:
    """Return the parameterId configured for a reservoir and logical signal."""
    reservoirs = _required_mapping(config, "reservoirs", "config")
    normalized_reservoir_id = normalize_reservoir_id(reservoir_id)
    reservoir = _required_mapping(reservoirs, normalized_reservoir_id, "reservoirs")

    if signal.startswith("q.in.for."):
        q_in_for = _required_mapping(
            reservoir,
            "q.in.for",
            f"reservoirs.{normalized_reservoir_id}",
        )
        parts = signal.removeprefix("q.in.for.").split(".")
        value: Any = q_in_for
        context = f"reservoirs.{normalized_reservoir_id}.q.in.for"
        for part in parts:
            if not isinstance(value, Mapping):
                raise ReservoirConfigurationError(
                    f"Expected {context} to be an object before resolving {part!r}."
                )
            value = _required_value(value, part, context)
            context = f"{context}.{part}"
    else:
        value = _required_value(
            reservoir,
            signal,
            f"reservoirs.{normalized_reservoir_id}",
        )

    if not isinstance(value, str) or not value.strip():
        raise ReservoirConfigurationError(
            f"Expected parameterId for {normalized_reservoir_id}.{signal} to be a non-empty string."
        )

    return value.strip()


def load_signal_payloads(
    base_path: str | Path,
    source: Mapping[str, Any],
) -> list[Mapping[str, Any]]:
    """Load payloads for a configured source."""
    source_format = _required_value(source, "format", "source")
    source_timezone = resolve_source_timezone(source)
    origin = _required_mapping(source, "origin", "source")
    origin_type = _required_value(origin, "type", "source.origin")
    if origin_type != "file_pattern":
        raise ReservoirConfigurationError(
            f"Only file_pattern origins are supported for now; got {origin_type!r}."
        )

    file_pattern = _required_value(origin, "file_pattern", "source.origin")
    paths = resolve_file_pattern(base_path, file_pattern)
    if not paths:
        raise ReservoirDataError(
            f"No files matched source pattern {file_pattern!r} "
            f"from base path {Path(base_path).resolve()}."
        )

    if source_format == "json":
        return [load_time_series_payload(path, source_timezone) for path in paths]

    if source_format == "wiski_csv":
        return [load_wiski_csv_payload(path, source_timezone) for path in paths]

    raise ReservoirConfigurationError(
        f"Unsupported source format {source_format!r}; expected 'json' or 'wiski_csv'."
    )


def resolve_source_timezone(source: Mapping[str, Any]) -> str:
    """Return and validate the configured source timezone."""
    timezone = _required_value(source, "timezone", "source")
    if not isinstance(timezone, str) or not timezone.strip():
        raise ReservoirConfigurationError("Expected source.timezone to be a non-empty string.")

    timezone = timezone.strip()
    if timezone not in pytz.all_timezones:
        raise ReservoirConfigurationError(
            f"Unsupported source timezone {timezone!r}; expected a value from pytz.all_timezones."
        )

    return timezone


def annotate_payload_timezone(
    payload: Mapping[str, Any],
    source_timezone: str,
) -> Mapping[str, Any]:
    """Annotate each timeSeries header with the configured source timezone."""
    time_series = payload.get("timeSeries")
    if isinstance(time_series, list):
        for series in time_series:
            if not isinstance(series, dict):
                continue

            header = series.get("header")
            if isinstance(header, dict):
                header["sourceTimezone"] = source_timezone

    return payload


def resolve_file_pattern(base_path: str | Path, file_pattern: str) -> list[Path]:
    """Resolve a configured file pattern from a stable base directory."""
    pattern = Path(file_pattern).expanduser()
    if pattern.is_absolute():
        return sorted(Path(path) for path in glob.glob(str(pattern)))

    return sorted(Path(base_path).resolve().glob(file_pattern))


def load_time_series_payload(
    path: str | Path,
    source_timezone: str = "UTC",
) -> Mapping[str, Any]:
    """Load one FEWS-like timeSeries JSON payload."""
    with Path(path).open(encoding="utf-8") as source:
        payload = json.load(source)

    if not isinstance(payload, Mapping):
        raise ReservoirDataError(f"Expected {path} to contain a JSON object.")

    return annotate_payload_timezone(payload, source_timezone)


def load_wiski_csv_payload(
    path: str | Path,
    source_timezone: str = "UTC",
) -> Mapping[str, Any]:
    """Load a WISKI CSV file as a FEWS-like timeSeries payload."""
    text = _read_text_with_fallback_encodings(Path(path))
    time_series: list[Mapping[str, Any]] = []
    header: dict[str, str] = {}
    events: list[dict[str, str]] = []

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        if _is_wiski_event_line(line):
            if not header:
                raise ReservoirDataError(
                    f"Found WISKI event before header in {path} at line {line_number}."
                )
            events.append(_parse_wiski_event(line, path, line_number))
            continue

        if events:
            time_series.append(_build_wiski_time_series(header, events, path, source_timezone))
            header = {}
            events = []

        key, value = _parse_wiski_header_line(line, path, line_number)
        if key in WISKI_HEADER_FIELDS:
            header[key] = value

    if header or events:
        time_series.append(_build_wiski_time_series(header, events, path, source_timezone))

    return {"timeSeries": time_series}


def _read_text_with_fallback_encodings(path: Path) -> str:
    last_error = None
    for encoding in WISKI_ENCODINGS:
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError as exc:
            last_error = exc

    raise ReservoirDataError(
        f"Could not decode WISKI CSV file {path} with encodings {WISKI_ENCODINGS}."
    ) from last_error


def _is_wiski_event_line(line: str) -> bool:
    parts = line.split(";")
    if len(parts) < 3:
        return False

    try:
        datetime.strptime(f"{parts[0].strip()} {parts[1].strip()}", "%d/%m/%Y %H:%M:%S")
    except ValueError:
        return False

    return True


def _parse_wiski_event(line: str, path: str | Path, line_number: int) -> dict[str, str]:
    parts = [part.strip() for part in line.split(";")]
    if len(parts) < 3:
        raise ReservoirDataError(
            f"Expected WISKI event with date;time;value in {path} at line {line_number}."
        )

    try:
        timestamp = datetime.strptime(f"{parts[0]} {parts[1]}", "%d/%m/%Y %H:%M:%S")
    except ValueError as exc:
        raise ReservoirDataError(
            f"Invalid WISKI timestamp in {path} at line {line_number}: {line!r}."
        ) from exc

    return {
        "date": timestamp.date().isoformat(),
        "time": timestamp.time().isoformat(),
        "value": parts[2].replace(",", "."),
    }


def _parse_wiski_header_line(
    line: str,
    path: str | Path,
    line_number: int,
) -> tuple[str, str]:
    if "\t" in line:
        key, value = line.split("\t", maxsplit=1)
    elif ":" in line:
        key, value = line.split(":", maxsplit=1)
    else:
        raise ReservoirDataError(
            f"Expected WISKI header line in {path} at line {line_number}: {line!r}."
        )

    return key.strip().rstrip(":"), value.strip()


def _build_wiski_time_series(
    header: Mapping[str, str],
    events: Sequence[Mapping[str, str]],
    path: str | Path,
    source_timezone: str,
) -> Mapping[str, Any]:
    location_id = header.get(WISKI_LOCATION_ID_KEY)
    parameter_id = header.get(WISKI_PARAMETER_ID_KEY)
    if not location_id or not parameter_id:
        raise ReservoirDataError(
            f"WISKI time series in {path} is missing '{WISKI_LOCATION_ID_KEY}' "
            f"or '{WISKI_PARAMETER_ID_KEY}'."
        )

    return {
        "header": {
            "locationId": location_id,
            "parameterId": parameter_id,
            "stationName": header.get("Nombre de la estación", ""),
            "units": header.get("Unidad de la serie temporal", ""),
            "sourceFormat": "wiski_csv",
            "sourcePath": str(path),
            "sourceTimezone": source_timezone,
            "wiskiHeader": dict(header),
        },
        "events": list(events),
    }


def find_time_series(
    payloads: Sequence[Mapping[str, Any]],
    reservoir_id: str,
    parameter_id: str,
) -> Mapping[str, Any]:
    """Find exactly one timeSeries item for locationId and parameterId."""
    series = find_optional_time_series(payloads, reservoir_id, parameter_id)
    if series is None:
        raise ReservoirDataError(
            f"No time series found for locationId={reservoir_id!r} "
            f"and parameterId={parameter_id!r}."
        )

    return series


def find_optional_time_series(
    payloads: Sequence[Mapping[str, Any]],
    reservoir_id: str,
    parameter_id: str,
) -> Mapping[str, Any] | None:
    """Return a matching timeSeries item, or None when it is absent."""
    matches: list[Mapping[str, Any]] = []

    for payload in payloads:
        time_series = payload.get("timeSeries")
        if not isinstance(time_series, list):
            raise ReservoirDataError("Expected root key 'timeSeries' to be a list.")

        for series in time_series:
            if not isinstance(series, Mapping):
                continue

            header = series.get("header")
            if not isinstance(header, Mapping):
                continue

            if (
                header.get("locationId") == reservoir_id
                and header.get("parameterId") == parameter_id
            ):
                matches.append(series)

    if len(matches) > 1:
        raise ReservoirDataError(
            f"Found {len(matches)} time series for locationId={reservoir_id!r} "
            f"and parameterId={parameter_id!r}; expected exactly one."
        )

    return matches[0] if matches else None


def events_to_pandas_series(series_payload: Mapping[str, Any], name: str):
    """Convert a FEWS-like event list to a pandas Series."""
    pd = _import_pandas()
    events = series_payload.get("events")
    if not isinstance(events, list):
        raise ReservoirDataError("Expected time series 'events' to be a list.")

    header = series_payload.get("header")
    miss_value = None
    source_timezone = "UTC"
    if isinstance(header, Mapping):
        miss_value = header.get("missVal")
        source_timezone = str(header.get("sourceTimezone", "UTC"))

    timestamps: list[str] = []
    values: list[Any] = []

    for index, event in enumerate(events):
        if not isinstance(event, Mapping):
            raise ReservoirDataError(f"Expected events[{index}] to be an object.")

        date = _required_value(event, "date", f"events[{index}]")
        time = _required_value(event, "time", f"events[{index}]")
        value = _required_value(event, "value", f"events[{index}]")
        timestamps.append(f"{date} {time}")
        values.append(None if miss_value is not None and value == miss_value else value)

    return pd.Series(
        pd.to_numeric(values, errors="coerce"),
        index=to_utc_datetime_index(pd.to_datetime(timestamps), source_timezone),
        name=name,
    )


def to_utc_datetime_index(index, source_timezone: str):
    """Localize source timestamps and return a UTC pandas DatetimeIndex."""
    pd = _import_pandas()
    if source_timezone not in pytz.all_timezones:
        raise ReservoirConfigurationError(
            f"Unsupported source timezone {source_timezone!r}; expected a value from pytz.all_timezones."
        )

    datetime_index = pd.DatetimeIndex(index)
    if datetime_index.tz is None:
        datetime_index = datetime_index.tz_localize(pytz.timezone(source_timezone))
    else:
        datetime_index = datetime_index.tz_convert(pytz.timezone(source_timezone))

    return datetime_index.tz_convert("UTC")


def summarize_dataframe(dataframe) -> list[dict[str, Any]]:
    """Return a compact summary for a long-format signal DataFrame."""
    summary: list[dict[str, Any]] = []
    value_columns = [
        column for column in dataframe.columns if column not in {"reservoir", "timestamp"}
    ]

    for reservoir_id, reservoir_frame in dataframe.groupby("reservoir", sort=True):
        ordered_frame = reservoir_frame.sort_values("timestamp")
        for signal in value_columns:
            values = ordered_frame[signal]
            summary.append(
                {
                    "reservoir": reservoir_id,
                    "signal": signal,
                    "rows": int(ordered_frame.shape[0]),
                    "valid_values": int(values.notna().sum()),
                    "start": ordered_frame["timestamp"].min() if not ordered_frame.empty else None,
                    "end": ordered_frame["timestamp"].max() if not ordered_frame.empty else None,
                    "first_value": values.iloc[0] if not ordered_frame.empty else None,
                    "last_value": values.iloc[-1] if not ordered_frame.empty else None,
                }
            )

    return summary


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run a reservoir pipeline and build its pandas DataFrames."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="Reservoir configuration JSON.",
    )
    parser.add_argument(
        "--reservoir",
        action="append",
        dest="reservoirs",
        default=[],
        help="Reservoir id. Can be repeated. Example: E_08",
    )
    parser.add_argument(
        "--pipeline",
        choices=PIPELINE_CHOICES,
        default="harmonie",
        help="Execution pipeline to run.",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run only TEST_RESERVOIRS instead of all configured reservoirs.",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print dataframe summaries instead of the v.balance JSON payload.",
    )
    args = parser.parse_args(argv)

    if args.reservoirs:
        reservoirs = args.reservoirs
    elif args.test:
        reservoirs = TEST_RESERVOIRS
    else:
        reservoirs = None
    try:
        result = run_reservoir_pipeline(
            args.config,
            reservoirs=reservoirs,
            pipeline=args.pipeline,
        )
    except (ModuleNotFoundError, ReservoirConfigurationError, ReservoirDataError) as exc:
        parser.exit(1, f"{exc}\n")

    if args.summary:
        print(f"Pipeline: {result.pipeline}")
        print(f"Forecast signals: {list(result.forecast_signals)}")
        print(f"t0: {result.t0}")
        print_dataframe_summary("Observed volume", result.observed_volume)
        print_observed_volume_at_t0(result.observed_volume_at_t0)
        print_dataframe_summary("Forecast", result.forecast)
    else:
        print(
            json.dumps(
                build_balance_time_series_payload(result),
                ensure_ascii=False,
                indent=2,
            )
        )

    return 0


def print_dataframe_summary(label: str, dataframe) -> None:
    """Print a compact summary for one generated DataFrame."""
    print(f"{label} DataFrame shape: {dataframe.shape}")
    print(f"{label} reservoirs: {list(dataframe['reservoir'].drop_duplicates())}")
    print(f"{label} columns: {list(dataframe.columns)}")
    for item in summarize_dataframe(dataframe):
        print(
            "{reservoir} {signal}: {rows} rows, {valid_values} valid values, "
            "{start} -> {end}, {first_value} -> {last_value}".format(**item)
        )


def print_observed_volume_at_t0(dataframe) -> None:
    """Print the observed volume selected for t0."""
    print("Observed volume at t0:")
    for _, row in dataframe.iterrows():
        print(
            f"{row['reservoir']}: v.obs={row['v.obs.t0']} "
            f"at {row['v.obs.timestamp']} "
            f"(delta {row['v.obs.time_delta']})"
        )


def _required_mapping(
    source: Mapping[str, Any],
    key: str,
    context: str,
) -> Mapping[str, Any]:
    value = _required_value(source, key, context)
    if not isinstance(value, Mapping):
        raise ReservoirConfigurationError(f"Expected {context}.{key} to be an object.")
    return value


def _required_value(source: Mapping[str, Any], key: str, context: str) -> Any:
    if key not in source:
        raise ReservoirConfigurationError(f"Missing required key {context}.{key}.")
    return source[key]


def _resolve_existing_file(path: str | Path, description: str) -> Path:
    requested = Path(path).expanduser()
    if requested.is_absolute():
        if requested.is_file():
            return requested.resolve()
        raise ReservoirConfigurationError(f"Could not find {description} file {requested}.")

    bases = (Path.cwd(), PROJECT_ROOT)
    checked: list[Path] = []
    for base in bases:
        candidate = (base / requested).resolve()
        checked.append(candidate)
        if candidate.is_file():
            return candidate

    checked_paths = ", ".join(str(candidate) for candidate in checked)
    raise ReservoirConfigurationError(
        f"Could not find {description} file {requested!s}. Checked: {checked_paths}."
    )


def _import_pandas():
    try:
        import pandas as pd
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "pandas is required to build reservoir signal DataFrames. "
            "Install pandas in this environment and rerun the command."
        ) from exc

    return pd


if __name__ == "__main__":
    raise SystemExit(main())
