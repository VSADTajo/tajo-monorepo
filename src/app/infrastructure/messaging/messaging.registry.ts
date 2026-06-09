// ─────────────────────────────────────────────────────────────
// Queue Names — direct queue processing (point-to-point)
// ─────────────────────────────────────────────────────────────

export const Queues = {
    EXAMPLE_PROCESSING: 'example-processing',
};

// ─────────────────────────────────────────────────────────────
// Topic Exchanges — pub/sub with routing keys
// ─────────────────────────────────────────────────────────────

export const Topics = {
    USER_EVENTS: {
        exchange: 'user-events',
        routingKeys: {
            CREATED: 'user.created',
            UPDATED: 'user.updated',
        },
    },
};
