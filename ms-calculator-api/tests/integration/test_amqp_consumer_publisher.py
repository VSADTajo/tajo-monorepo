"""Integration tests: AMQP consumer → pipeline → publisher with real RabbitMQ."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

FIXTURE_INPUT = Path(__file__).parent.parent / "fixtures" / "simulation_output_e08_e09.json"
FIXTURE_GOLDEN = Path(__file__).parent.parent / "fixtures" / "expected_balance_output.json"
TEST_CONFIG = Path(__file__).parent.parent / "fixtures" / "reservoir_parameters_test.json"

EXCHANGE_NAME = "simulation-events"
INPUT_ROUTING_KEY = "simulation.manual.output.fetched"
OUTPUT_COMPUTED_KEY = "simulation.manual.balance.computed"
OUTPUT_FAILED_KEY = "simulation.manual.balance.failed"
INPUT_QUEUE = "calculator-simulation-manual-output"
INSPECTOR_COMPUTED_QUEUE = "test-inspector-computed"
INSPECTOR_FAILED_QUEUE = "test-inspector-failed"


@pytest.fixture(scope="class")
def rabbitmq_container():
    """Spin up a real RabbitMQ testcontainer for the test class."""
    from testcontainers.rabbitmq import RabbitMqContainer

    with RabbitMqContainer("rabbitmq:3.13-management-alpine") as rmq:
        yield rmq


@pytest.fixture(scope="class")
def rabbitmq_url(rabbitmq_container):
    host = rabbitmq_container.get_container_host_ip()
    port = rabbitmq_container.get_exposed_port(5672)
    return f"amqp://guest:guest@{host}:{port}/"


@pytest.fixture(scope="function")
async def amqp_channel(rabbitmq_url):
    """Open a fresh aio-pika connection + channel for each test."""
    import aio_pika

    connection = await aio_pika.connect_robust(rabbitmq_url)
    channel = await connection.channel()
    yield channel
    await connection.close()


async def setup_exchange_and_queues(channel, extra_queues: list[tuple[str, str]] | None = None):
    """Declare exchange + required queues for a test."""
    import aio_pika

    exchange = await channel.declare_exchange(
        EXCHANGE_NAME, type=aio_pika.ExchangeType.TOPIC, durable=True
    )
    # Consumer input queue
    in_queue = await channel.declare_queue(INPUT_QUEUE, durable=True)
    await in_queue.bind(exchange, INPUT_ROUTING_KEY)

    queues = {}
    for queue_name, routing_key in extra_queues or []:
        q = await channel.declare_queue(queue_name, durable=False, auto_delete=True)
        await q.bind(exchange, routing_key)
        queues[queue_name] = q

    return exchange, queues


async def publish_message(exchange, routing_key: str, payload: dict):
    """Publish a JSON message to the exchange."""
    import aio_pika

    message = aio_pika.Message(
        body=json.dumps(payload).encode("utf-8"),
        content_type="application/json",
    )
    await exchange.publish(message, routing_key=routing_key)


async def start_service_consumer(rabbitmq_url: str) -> tuple:
    """Start the AMQP consumer in a background task and return (consumer, task)."""
    from src.application.calculator_service import CalculatorService, SystemClock
    from src.infrastructure.amqp.connection import AmqpConnection
    from src.infrastructure.amqp.consumer import SimulationOutputConsumer
    from src.infrastructure.amqp.publisher import AmqpBalanceEventPublisher

    conn = AmqpConnection(url=rabbitmq_url)
    await conn.connect()

    publisher = AmqpBalanceEventPublisher(connection=conn)
    svc = CalculatorService(
        config_path=TEST_CONFIG,
        publisher=publisher,
        clock=SystemClock(),
    )
    consumer = SimulationOutputConsumer(connection=conn, service=svc)
    task = asyncio.create_task(consumer.start())
    return consumer, task, conn


@pytest.mark.skip(
    reason="Requires Docker daemon — run in CI or with explicit --run-integration flag"
)
class TestAmqpConsumerPublisher:
    """End-to-end AMQP round-trip tests with real RabbitMQ testcontainer."""

    async def test_valid_payload_produces_computed_event(self, rabbitmq_url: str) -> None:
        """Publishing a valid input causes one computed event within 10s."""
        import aio_pika

        fixture = json.loads(FIXTURE_INPUT.read_text())

        # Set up inspector queues
        inspector_conn = await aio_pika.connect_robust(rabbitmq_url)
        channel = await inspector_conn.channel()
        exchange, queues = await setup_exchange_and_queues(
            channel,
            extra_queues=[
                (INSPECTOR_COMPUTED_QUEUE, OUTPUT_COMPUTED_KEY),
                (INSPECTOR_FAILED_QUEUE, OUTPUT_FAILED_KEY),
            ],
        )

        # Start the service consumer
        _consumer, task, svc_conn = await start_service_consumer(rabbitmq_url)

        # Give the consumer a moment to bind
        await asyncio.sleep(1.0)

        try:
            # Publish test fixture
            await publish_message(exchange, INPUT_ROUTING_KEY, fixture)

            # Wait up to 10s for the computed event
            computed_queue = queues[INSPECTOR_COMPUTED_QUEUE]
            message = None
            for _ in range(20):
                try:
                    message = await computed_queue.get(timeout=0.5, no_ack=True)
                    break
                except Exception:
                    await asyncio.sleep(0.5)

            assert message is not None, "Expected computed event within 10s"
            body = json.loads(message.body)
            assert body["simulationId"] == fixture["simulationId"]
            assert body["providerName"] == "volume-calculator"
            assert body["seriesCount"] == 12
            assert len(body["timeSeries"]) == 12
        finally:
            task.cancel()
            await asyncio.sleep(0.1)
            await svc_conn.close()
            await inspector_conn.close()

    async def test_malformed_payload_produces_failed_event(self, rabbitmq_url: str) -> None:
        """Publishing a malformed payload causes one failed event."""
        import aio_pika

        bad_payload = {"simulationId": "bad-test", "providerName": "manual-simulation"}

        inspector_conn = await aio_pika.connect_robust(rabbitmq_url)
        channel = await inspector_conn.channel()
        exchange, queues = await setup_exchange_and_queues(
            channel,
            extra_queues=[(INSPECTOR_FAILED_QUEUE, OUTPUT_FAILED_KEY)],
        )

        _consumer, task, svc_conn = await start_service_consumer(rabbitmq_url)
        await asyncio.sleep(1.0)

        try:
            await publish_message(exchange, INPUT_ROUTING_KEY, bad_payload)

            failed_queue = queues[INSPECTOR_FAILED_QUEUE]
            message = None
            for _ in range(20):
                try:
                    message = await failed_queue.get(timeout=0.5, no_ack=True)
                    break
                except Exception:
                    await asyncio.sleep(0.5)

            assert message is not None, "Expected failed event within 10s"
            body = json.loads(message.body)
            assert body["simulationId"] == "bad-test"
            assert body["errorType"] in ("invalid_payload", "config_error")
            assert body["retryable"] is False
        finally:
            task.cancel()
            await asyncio.sleep(0.1)
            await svc_conn.close()
            await inspector_conn.close()
