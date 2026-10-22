"""FastAPI application factory for ms-calculator-api."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.config.settings import get_settings
from src.infrastructure.logging.structlog_config import configure_logging, get_logger

logger = get_logger()

# Module-level references to be set during lifespan (injectable for tests)
_amqp_connection: Any = None
_consumer_task: Any = None


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    configure_logging(
        level=settings.APP_LOG_LEVEL,
        logs_api_url=settings.LOGS_API_URL,
        logs_api_key=settings.X_API_KEY,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        global _amqp_connection, _consumer_task

        from src.application.calculator_service import CalculatorService, SystemClock
        from src.infrastructure.amqp.connection import AmqpConnection
        from src.infrastructure.amqp.consumer import SimulationOutputConsumer
        from src.infrastructure.amqp.publisher import AmqpBalanceEventPublisher

        amqp_url = (
            f"amqp://{settings.RABBITMQ_USER}:{settings.RABBITMQ_PASSWORD}"
            f"@{settings.RABBITMQ_HOST}:{settings.RABBITMQ_PORT}{settings.RABBITMQ_VHOST}"
        )

        conn = AmqpConnection(url=amqp_url)
        max_attempts = settings.RABBITMQ_CONNECT_MAX_ATTEMPTS
        retry_delay = settings.RABBITMQ_CONNECT_RETRY_DELAY_MS / 1000
        last_exc: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                await conn.connect()
                last_exc = None
                logger.info(
                    "startup.amqp_connected",
                    message="AMQP connection established",
                    host=settings.RABBITMQ_HOST,
                    port=settings.RABBITMQ_PORT,
                    attempt=attempt,
                )
                break
            except Exception as exc:
                last_exc = exc
                if attempt < max_attempts:
                    logger.warning(
                        "startup.amqp_retry",
                        message=f"AMQP not ready, retrying in {retry_delay:.1f}s",
                        host=settings.RABBITMQ_HOST,
                        attempt=attempt,
                        max_attempts=max_attempts,
                    )
                    await asyncio.sleep(retry_delay)

        if last_exc is not None:
            logger.error(
                "startup.amqp_failed",
                message=(
                    f"Could not connect to AMQP after {max_attempts} attempts: "
                    f"{last_exc}"
                ),
                host=settings.RABBITMQ_HOST,
                exc_info=last_exc,
            )
            # Store None so health check reports degraded
            _amqp_connection = None
            app.state.amqp_connection = None
            logger.info(
                "startup.http_ready",
                message="HTTP server ready (AMQP unavailable)",
                port=settings.APP_PORT,
            )
            yield
            return

        _amqp_connection = conn
        app.state.amqp_connection = conn

        config_path = Path(settings.RESERVOIR_CONFIG_PATH)
        publisher = AmqpBalanceEventPublisher(connection=conn)
        svc = CalculatorService(
            config_path=config_path,
            publisher=publisher,
            clock=SystemClock(),
        )

        consumer = SimulationOutputConsumer(connection=conn, service=svc)
        _consumer_task = asyncio.create_task(consumer.start())

        logger.info(
            "startup.http_ready",
            message="HTTP server ready",
            port=settings.APP_PORT,
        )

        yield

        # Shutdown
        logger.info("shutdown.begin", message="Shutting down", reason="lifespan_end")
        if _consumer_task is not None and not _consumer_task.done():
            _consumer_task.cancel()
            try:
                await asyncio.wait_for(_consumer_task, timeout=5.0)
            except (TimeoutError, asyncio.CancelledError):
                pass
        await conn.close()

    application = FastAPI(
        title="ms-calculator-api",
        description="Volume-balance calculator microservice",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Register routes
    from src.api.routes.calculate import install_validation_error_handler
    from src.api.routes.calculate import router as calculate_router

    application.include_router(calculate_router)
    install_validation_error_handler(application)

    # Register health route
    from src.api.routes.health import router as health_router

    application.include_router(health_router)

    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            message=str(exc),
            path=str(request.url.path),
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": "An unexpected error occurred",
                "details": [],
            },
        )

    return application


app = create_app()
