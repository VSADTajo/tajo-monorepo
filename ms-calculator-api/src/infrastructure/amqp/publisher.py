"""AMQP balance event publisher implementing BalanceEventPublisherPort."""

from __future__ import annotations

import json
from typing import Any

import structlog

from src.api.schemas.balance_output import BalanceComputedPayload, BalanceFailedPayload
from src.infrastructure.amqp.connection import AmqpConnection
from src.infrastructure.amqp.registry import (
    EXCHANGE_SIMULATION_EVENTS,
    ROUTING_KEY_BALANCE_COMPUTED,
    ROUTING_KEY_BALANCE_FAILED,
)

logger = structlog.get_logger()


class AmqpBalanceEventPublisher:
    """Publishes balance events to the simulation-events exchange."""

    def __init__(self, connection: AmqpConnection) -> None:
        self._connection = connection
        self._exchange: Any = None

    async def _get_exchange(self) -> Any:
        """Declare the exchange (idempotent) and cache it."""
        if self._exchange is None:
            import aio_pika

            channel = self._connection.publisher_channel()
            self._exchange = await channel.declare_exchange(
                EXCHANGE_SIMULATION_EVENTS,
                type=aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
        return self._exchange

    async def publish_computed(self, payload: BalanceComputedPayload) -> None:
        """Publish a successful balance computation event."""
        await self._publish(
            routing_key=ROUTING_KEY_BALANCE_COMPUTED,
            payload_dict=payload.model_dump(),
            simulation_id=payload.simulationId,
        )

    async def publish_failed(self, payload: BalanceFailedPayload) -> None:
        """Publish a failed balance computation event."""
        await self._publish(
            routing_key=ROUTING_KEY_BALANCE_FAILED,
            payload_dict=payload.model_dump(),
            simulation_id=payload.simulationId,
        )

    async def _publish(
        self,
        routing_key: str,
        payload_dict: dict[str, Any],
        simulation_id: str,
    ) -> None:
        import aio_pika

        body = json.dumps(payload_dict, ensure_ascii=False).encode("utf-8")
        exchange = await self._get_exchange()

        message = aio_pika.Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            headers={"x-simulation-id": simulation_id},
        )
        await exchange.publish(message, routing_key=routing_key)
        logger.info(
            "publisher.event_sent",
            message=f"Published {routing_key}",
            routing_key=routing_key,
            message_size=len(body),
        )
