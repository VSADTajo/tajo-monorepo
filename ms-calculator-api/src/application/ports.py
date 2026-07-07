"""Port (Protocol) definitions for the application layer."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable

from src.api.schemas.balance_output import BalanceComputedPayload, BalanceFailedPayload


@runtime_checkable
class BalanceEventPublisherPort(Protocol):
    """Port for publishing balance events to the message broker."""

    async def publish_computed(self, payload: BalanceComputedPayload) -> None:
        """Publish a successful balance computation event."""
        ...

    async def publish_failed(self, payload: BalanceFailedPayload) -> None:
        """Publish a failed balance computation event."""
        ...


@runtime_checkable
class ClockPort(Protocol):
    """Port providing the current UTC time."""

    def now_utc(self) -> datetime:
        """Return the current UTC datetime."""
        ...
