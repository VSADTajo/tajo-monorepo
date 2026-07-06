"""AMQP exchange, routing key and queue name constants."""

from __future__ import annotations

EXCHANGE_SIMULATION_EVENTS = "simulation-events"

ROUTING_KEY_OUTPUT_FETCHED = "simulation.manual.output.fetched"
ROUTING_KEY_BALANCE_COMPUTED = "simulation.manual.balance.computed"
ROUTING_KEY_BALANCE_FAILED = "simulation.manual.balance.failed"

QUEUE_CALCULATOR_INPUT = "calculator-simulation-manual-output"
