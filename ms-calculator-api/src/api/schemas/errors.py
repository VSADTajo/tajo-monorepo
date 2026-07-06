"""Pydantic error response model."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    """Standardised error response shape for all HTTP error responses."""

    model_config = ConfigDict(extra="allow")

    error: str
    message: str
    details: list[Any] = []
