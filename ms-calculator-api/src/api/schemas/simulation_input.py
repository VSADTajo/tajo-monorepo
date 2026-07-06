"""Pydantic models for the simulation output payload (input to this service)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class TimeSeriesEvent(BaseModel):
    """One event row: date, time, value, flag."""

    model_config = ConfigDict(extra="allow")

    date: str
    time: str
    value: str
    flag: str = "2"


class TimeSeriesHeader(BaseModel):
    """Metadata for one time series."""

    model_config = ConfigDict(extra="allow")

    locationId: str
    parameterId: str
    parameterName: str | None = None
    units: str | None = None
    type: str | None = None
    timeStep: dict[str, Any] | None = None
    startDate: dict[str, str] | None = None
    endDate: dict[str, str] | None = None
    forecastDate: dict[str, str] | None = None
    missVal: str | None = "-999.0"
    stationName: str | None = None
    sourceTimezone: str | None = "UTC"


class TimeSeriesEntry(BaseModel):
    """One time series: header + events list."""

    model_config = ConfigDict(extra="allow")

    header: TimeSeriesHeader
    events: list[TimeSeriesEvent] = []


class SimulationOutputPayload(BaseModel):
    """Full simulation output payload consumed from AMQP or POST /calculate."""

    model_config = ConfigDict(extra="allow")

    simulationId: str
    providerName: str
    providerType: str | None = None
    providerConfigId: str | None = None
    outputFolder: str | None = None
    seriesCount: int | None = None
    eventsCount: int | None = None
    timeSeries: list[TimeSeriesEntry]
