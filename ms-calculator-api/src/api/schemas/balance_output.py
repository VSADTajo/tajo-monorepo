"""Pydantic models for the balance computation output payload."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class BalanceTimeSeriesHeader(BaseModel):
    """Header for a computed balance time series entry."""

    model_config = ConfigDict(extra="allow")

    type: str = "instantaneous"
    moduleInstanceId: str = "volume_calculator"
    locationId: str
    parameterId: str
    timeStep: dict[str, Any]
    startDate: dict[str, str]
    endDate: dict[str, str]
    forecastDate: dict[str, str]
    missVal: str = "-999.0"
    stationName: str
    units: str = "hm3"
    creationDate: str
    creationTime: str
    approvedDate: dict[str, str]


class BalanceTimeSeriesEntry(BaseModel):
    """One balance time series entry with header and events."""

    model_config = ConfigDict(extra="allow")

    header: BalanceTimeSeriesHeader
    events: list[dict[str, str]]


class BalanceComputedPayload(BaseModel):
    """Full output payload published when balance computation succeeds."""

    model_config = ConfigDict(extra="allow")

    simulationId: str
    providerName: str = "volume-calculator"
    seriesCount: int
    eventsCount: int
    computedAt: str
    timeSeries: list[dict[str, Any]]


class BalanceFailedPayload(BaseModel):
    """Output payload published when balance computation fails."""

    model_config = ConfigDict(extra="allow")

    simulationId: str
    providerName: str = "volume-calculator"
    reason: str
    errorType: str
    retryable: bool = False
    occurredAt: str
