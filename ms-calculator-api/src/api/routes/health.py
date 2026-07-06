"""GET /health — AMQP health check endpoint."""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()
logger = structlog.get_logger()


@router.get(
    "/health",
    summary="Health check",
    description="Returns the health status of the service and its dependencies.",
    responses={
        200: {"description": "Service is healthy"},
        503: {"description": "Service is degraded (AMQP unreachable)"},
    },
)
async def get_health(request: Request) -> JSONResponse:
    """Check AMQP connectivity and return health status."""
    amqp_conn = getattr(request.app.state, "amqp_connection", None)

    amqp_ok = False
    if amqp_conn is not None:
        try:
            amqp_ok = bool(amqp_conn.is_open())
        except Exception:
            amqp_ok = False

    amqp_status = "ok" if amqp_ok else "down"
    overall_status = "ok" if amqp_ok else "degraded"
    status_code = 200 if amqp_ok else 503

    logger.debug(
        "http.health.check",
        message="Health check performed",
        amqp_status=amqp_status,
    )

    return JSONResponse(
        status_code=status_code,
        content={
            "status": overall_status,
            "checks": {
                "amqp": amqp_status,
            },
        },
    )
