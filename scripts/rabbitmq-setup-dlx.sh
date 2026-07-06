#!/usr/bin/env bash
# rabbitmq-setup-dlx.sh — idempotente. Configura Dead Letter Exchange para el
# flujo de simulación manual con calculadora en infra-rabbitmq.
#
# Uso:
#   bash scripts/rabbitmq-setup-dlx.sh                  # local (assumes infra-rabbitmq container)
#   RABBITMQ_CONTAINER=my-rmq bash scripts/rabbitmq-setup-dlx.sh
#
# Referencia: .claude/rules/08-observability.md

set -euo pipefail

CONTAINER="${RABBITMQ_CONTAINER:-infra-rabbitmq}"
VHOST="${RABBITMQ_VHOST:-/}"
DLX_EXCHANGE="simulation-events-dlx"
DLQ_QUEUE="simulation-events-dead-letters"
POLICY_NAME="simulation-events-dlx"
QUEUES_PATTERN='^(calculator-simulation-manual-output|predictions-simulation-manual-balance)$'
MSG_TTL_MS="${MSG_TTL_MS:-86400000}"  # 24h

echo "[dlx] Container: ${CONTAINER}   vhost: ${VHOST}"

# 1) Declare DLX exchange (idempotente — declare con mismos args es no-op)
docker exec "${CONTAINER}" rabbitmqadmin --vhost="${VHOST}" \
  declare exchange \
    name="${DLX_EXCHANGE}" \
    type=topic \
    durable=true

# 2) Declare catch-all DLQ
docker exec "${CONTAINER}" rabbitmqadmin --vhost="${VHOST}" \
  declare queue \
    name="${DLQ_QUEUE}" \
    durable=true

# 3) Bind DLQ to DLX with '#' (catch-all)
docker exec "${CONTAINER}" rabbitmqadmin --vhost="${VHOST}" \
  declare binding \
    source="${DLX_EXCHANGE}" \
    destination="${DLQ_QUEUE}" \
    routing_key='#'

# 4) Apply policy so target queues route dead letters to the DLX
docker exec "${CONTAINER}" rabbitmqctl set_policy \
  --vhost="${VHOST}" \
  --apply-to queues \
  "${POLICY_NAME}" \
  "${QUEUES_PATTERN}" \
  "{\"dead-letter-exchange\":\"${DLX_EXCHANGE}\",\"message-ttl\":${MSG_TTL_MS}}"

echo "[dlx] Done. Verify with:"
echo "    docker exec ${CONTAINER} rabbitmqctl list_policies | grep ${POLICY_NAME}"
echo "    docker exec ${CONTAINER} rabbitmqadmin list queues name messages | grep ${DLQ_QUEUE}"
