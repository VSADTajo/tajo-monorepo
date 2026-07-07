"""POST /calculate — synchronous balance calculation endpoint."""

from __future__ import annotations

from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from src.api.schemas.balance_output import BalanceComputedPayload
from src.api.schemas.errors import ErrorResponse
from src.api.schemas.simulation_input import SimulationOutputPayload
from src.application.calculator_service import CalculatorService, SystemClock

router = APIRouter()
logger = structlog.get_logger()


def install_validation_error_handler(app: object) -> None:
    """Register a 422→400 converter on a FastAPI app instance."""
    from fastapi import FastAPI
    from fastapi.exceptions import RequestValidationError

    fa_app: FastAPI = app  # type: ignore[assignment]

    @fa_app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: object, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={
                "error": "invalid_payload",
                "message": "Request validation failed",
                "details": exc.errors(),
            },
        )


def _get_service(config_path: Path | None = None) -> CalculatorService:
    """Build a CalculatorService instance for the HTTP handler.

    Uses a no-op (in-memory) publisher since HTTP responses return the payload directly.
    """
    from src.config.settings import get_settings

    settings = get_settings()
    resolved_path = config_path or Path(settings.RESERVOIR_CONFIG_PATH)

    class _NoOpPublisher:
        async def publish_computed(self, payload: object) -> None:
            pass

        async def publish_failed(self, payload: object) -> None:
            pass

    return CalculatorService(
        config_path=resolved_path,
        publisher=_NoOpPublisher(),
        clock=SystemClock(),
    )


@router.post(
    "/calculate",
    response_model=BalanceComputedPayload,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid payload"},
        500: {"model": ErrorResponse, "description": "Internal error"},
    },
    summary="Synchronous volume-balance calculation",
    description=(
        "Accepts a SimulationOutputPayload and returns the computed balance "
        "timeSeries synchronously without publishing to AMQP."
    ),
)
async def post_calculate(
    payload: SimulationOutputPayload,
    request: Request,
) -> JSONResponse:
    """Compute volume balance for the given simulation payload."""
    structlog.contextvars.bind_contextvars(simulation_id=payload.simulationId)
    logger.info(
        "http.calculate.request_received",
        message="POST /calculate received",
        client_ip=getattr(request.client, "host", "unknown"),
    )

    try:
        svc = _get_service()
        if not payload.timeSeries:
            raise ValueError("timeSeries is empty or missing")

        result: BalanceComputedPayload = await svc.compute(payload)
        logger.info(
            "http.calculate.request_completed",
            message="POST /calculate completed",
            status_code=200,
        )
        return JSONResponse(content=result.model_dump(), status_code=200)

    except ValueError as exc:
        logger.warning(
            "http.calculate.validation_error",
            message=str(exc),
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_payload",
                "message": str(exc),
                "details": [],
            },
        ) from exc
    except Exception as exc:
        logger.error(
            "http.calculate.internal_error",
            message=str(exc),
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": "An unexpected error occurred",
                "details": [],
            },
        ) from exc
    finally:
        structlog.contextvars.clear_contextvars()
