"""AMQP connection factory using aio-pika RobustConnection."""

from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger()


class AmqpConnection:
    """Manages a robust aio-pika connection and a shared publisher channel."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._connection: Any = None
        self._publisher_channel: Any = None

    async def connect(self) -> None:
        """Open the robust connection and create the publisher channel."""
        import aio_pika

        self._connection = await aio_pika.connect_robust(self._url)
        self._publisher_channel = await self._connection.channel()
        logger.info(
            "amqp.connected",
            message="AMQP connection established",
            url=self._url,
        )

    async def close(self) -> None:
        """Close the connection gracefully."""
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
            self._publisher_channel = None
            logger.info("amqp.closed", message="AMQP connection closed")

    async def channel(self) -> Any:
        """Open and return a new channel (for consumers)."""
        if self._connection is None:
            raise RuntimeError("AmqpConnection is not connected — call connect() first")
        return await self._connection.channel()

    def publisher_channel(self) -> Any:
        """Return the shared publisher channel."""
        if self._publisher_channel is None:
            raise RuntimeError("AmqpConnection is not connected — call connect() first")
        return self._publisher_channel

    def is_open(self) -> bool:
        """Return True if the connection is open and not closed."""
        if self._connection is None:
            return False
        conn = self._connection
        return not getattr(conn, "is_closed", True)
