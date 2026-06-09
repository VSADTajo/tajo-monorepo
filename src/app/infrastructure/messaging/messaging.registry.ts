// ─────────────────────────────────────────────────────────────
// Queue Names — direct queue processing (point-to-point)
// ─────────────────────────────────────────────────────────────

export const Queues = {
    NOTIFICATION_PROCESSING: 'ms-notifications-api.notification.created',
};

// ─────────────────────────────────────────────────────────────
// Topic Exchanges — pub/sub with routing keys
// ─────────────────────────────────────────────────────────────

export const Topics = {
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
        queue: Queues.NOTIFICATION_PROCESSING,
        exchange: Topics.NOTIFICATIONS.exchange,
        routingKey: Topics.NOTIFICATIONS.routingKeys.CREATED,
    },
];
