"""Extract location/parameter inventories from time-series JSON files."""

from __future__ import annotations

import argparse
import csv
import json
from collections.abc import Iterable, Iterator, Mapping, Sequence
from pathlib import Path
from typing import Any


class TimeSeriesFormatError(ValueError):
    """Raised when a JSON payload does not match the expected timeSeries shape."""


LocationParameterPair = tuple[str, str]


def load_time_series_json(input_path: str | Path) -> Mapping[str, Any]:
    """Load a time-series JSON payload from disk."""
    path = Path(input_path)
    with path.open(encoding="utf-8") as source:
        payload = json.load(source)

    if not isinstance(payload, Mapping):
        raise TimeSeriesFormatError("Expected the JSON root to be an object.")

    return payload


def iter_location_parameter_pairs(
    payload: Mapping[str, Any],
) -> Iterator[LocationParameterPair]:
    """Yield unique ``(locationId, parameterId)`` pairs in source order."""
    time_series = payload.get("timeSeries")
    if not isinstance(time_series, list):
        raise TimeSeriesFormatError("Expected root key 'timeSeries' to be a list.")

    seen: set[LocationParameterPair] = set()

    for index, series in enumerate(time_series):
        if not isinstance(series, Mapping):
            raise TimeSeriesFormatError(
                f"Expected timeSeries[{index}] to be an object."
            )

        header = series.get("header")
        if not isinstance(header, Mapping):
            raise TimeSeriesFormatError(
                f"Expected timeSeries[{index}].header to be an object."
            )

        location_id = _required_header_value(header, "locationId", index)
        parameter_id = _required_header_value(header, "parameterId", index)
        pair = (location_id, parameter_id)

        if pair in seen:
            continue

        seen.add(pair)
        yield pair


def collect_location_parameters(payload: Mapping[str, Any]) -> list[LocationParameterPair]:
    """Return unique location/parameter pairs sorted by location and parameter."""
    return sorted(iter_location_parameter_pairs(payload), key=lambda pair: (pair[0], pair[1]))


def write_location_parameters_csv(
    pairs: Iterable[LocationParameterPair],
    output_path: str | Path,
) -> int:
    """Write location/parameter pairs to CSV and return the number of data rows."""
    rows = sorted(set(pairs), key=lambda pair: (pair[0], pair[1]))
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", newline="", encoding="utf-8") as destination:
        writer = csv.writer(destination)
        writer.writerow(["locationId", "parameterId"])
        writer.writerows(rows)

    return len(rows)


def extract_location_parameters(
    input_json_path: str | Path,
    output_csv_path: str | Path,
) -> int:
    """Read a time-series JSON file and write its location/parameter inventory."""
    payload = load_time_series_json(input_json_path)
    pairs = collect_location_parameters(payload)
    return write_location_parameters_csv(pairs, output_csv_path)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Extract unique locationId/parameterId pairs from a time-series JSON "
            "file and write them as CSV."
        )
    )
    parser.add_argument("input_json", type=Path, help="Input time-series JSON file.")
    parser.add_argument(
        "output_csv",
        nargs="?",
        type=Path,
        help=(
            "Output CSV path. Defaults to '<input>.location_parameters.csv' next to "
            "the input file."
        ),
    )
    args = parser.parse_args(argv)

    output_csv = args.output_csv or args.input_json.with_suffix(
        ".location_parameters.csv"
    )
    row_count = extract_location_parameters(args.input_json, output_csv)
    print(f"Wrote {row_count} location/parameter pairs to {output_csv}")
    return 0


def _required_header_value(
    header: Mapping[str, Any],
    key: str,
    time_series_index: int,
) -> str:
    value = header.get(key)
    if value in (None, ""):
        raise TimeSeriesFormatError(
            f"Expected timeSeries[{time_series_index}].header.{key} to be present."
        )
    return str(value)


if __name__ == "__main__":
    raise SystemExit(main())
