// ─────────────────────────────────────────────────────────────
// Queue Names — direct queue processing (point-to-point)
// ─────────────────────────────────────────────────────────────

export const Queues = {
    PREDICTIONS_TIMESERIES_PROCESSING: 'predictions-timeseries-processing',
    PREDICTIONS_SIMULATION_STATUS_UPDATES: 'predictions-simulation-status-updates',
};

// ─────────────────────────────────────────────────────────────
// Topic Exchanges — pub/sub with routing keys
// ─────────────────────────────────────────────────────────────

export const Topics = {
    MODEL_EVENTS: {
        exchange: 'model-events',
        routingKeys: {
            TIMESERIES_INGESTED: 'timeseries.ingested',
        },
    },
    SIMULATION_EVENTS: {
        exchange: 'simulation-events',
        routingKeys: {
            MANUAL_DISPATCHED: 'simulation.manual.dispatched',
            STATUS_UPDATED: 'simulation.status.updated',
        },
    },
    NOTIFICATIONS: {
        exchange: 'notifications',
        routingKeys: {
            CREATED: 'notification.created',
        },
    },
};

// ─────────────────────────────────────────────────────────────
// Topic Subscriptions — binds queues to topic exchanges
// This is the single source of truth for RabbitMQ bindings.
// main.ts creates the queue + consumer, RabbitmqService uses
// this array to create the exchange and bind queue↔exchange.
// ─────────────────────────────────────────────────────────────

export interface TopicSubscription {
    queue: string;
    exchange: string;
    routingKey: string;
}

export const TopicSubscriptions: TopicSubscription[] = [
    {
        queue: Queues.PREDICTIONS_TIMESERIES_PROCESSING,
        exchange: Topics.MODEL_EVENTS.exchange,
        routingKey: Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED,
    },
    {
        queue: Queues.PREDICTIONS_SIMULATION_STATUS_UPDATES,
        exchange: Topics.SIMULATION_EVENTS.exchange,
        routingKey: Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED,
    },
];
