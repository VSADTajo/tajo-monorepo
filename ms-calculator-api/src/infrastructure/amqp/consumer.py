"""AMQP consumer for simulation output events."""

from __future__ import annotations

import json
from typing import Any

import structlog

from src.infrastructure.amqp.connection import AmqpConnection
from src.infrastructure.amqp.registry import (
    EXCHANGE_SIMULATION_EVENTS,
    QUEUE_CALCULATOR_INPUT,
    ROUTING_KEY_OUTPUT_FETCHED,
)

logger = structlog.get_logger()


class SimulationOutputConsumer:
    """Consumes simulation.manual.output.fetched messages and delegates to CalculatorService."""

    def __init__(self, connection: AmqpConnection, service: Any) -> None:
        self._connection = connection
        self._service = service

    async def start(self) -> None:
        """Declare exchange + queue, bind, and start consuming messages."""
        import aio_pika

        channel = await self._connection.channel()
        await channel.set_qos(prefetch_count=10)

        exchange = await channel.declare_exchange(
            EXCHANGE_SIMULATION_EVENTS,
            type=aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        queue = await channel.declare_queue(QUEUE_CALCULATOR_INPUT, durable=True)
        await queue.bind(exchange, ROUTING_KEY_OUTPUT_FETCHED)

        logger.info(
            "startup.amqp_bound",
            message="Consumer queue bound",
            queue=QUEUE_CALCULATOR_INPUT,
            routing_key=ROUTING_KEY_OUTPUT_FETCHED,
        )

        async with queue.iterator() as messages:
            async for message in messages:
                await self._handle_message(message)

    async def _handle_message(self, message: Any) -> None:
        """Process one AMQP message — ack on success, nack on fatal error."""
        from pydantic import ValidationError

        from src.api.schemas.simulation_input import SimulationOutputPayload
        from src.application.calculator_service import CalculatorService

        svc: CalculatorService = self._service

        simulation_id = "unknown"
        try:
            body_bytes: bytes = message.body
            raw = json.loads(body_bytes.decode("utf-8"))
            simulation_id = raw.get("simulationId", "unknown")

            logger.info(
                "consumer.message_received",
                message="Message received",
                simulation_id=simulation_id,
                series_count=len(raw.get("timeSeries", [])),
            )

            try:
                payload = SimulationOutputPayload.model_validate(raw)
            except ValidationError as exc:
                import structlog as _structlog

                _structlog.contextvars.bind_contextvars(simulation_id=simulation_id)
                try:
                    await svc.publish_failed_from_raw(
                        simulation_id=simulation_id,
                        reason=f"Validation error: {exc}",
                        error_type="invalid_payload",
                    )
                finally:
                    _structlog.contextvars.clear_contextvars()

                await message.ack()
                logger.info(
                    "consumer.message_ack",
                    message="Message acked after validation failure",
                    outcome="failed",
                    simulation_id=simulation_id,
                )
                return

            await svc.execute(payload)
            await message.ack()
            logger.info(
                "consumer.message_ack",
                message="Message acked",
                outcome="computed",
                simulation_id=simulation_id,
            )

        except (RuntimeError, ConnectionError) as exc:
            logger.error(
                "consumer.message_nack",
                message=f"Fatal error — nacking: {exc}",
                simulation_id=simulation_id,
            )
            await message.nack(requeue=False)
