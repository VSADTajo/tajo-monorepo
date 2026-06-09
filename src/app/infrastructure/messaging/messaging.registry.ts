// ─────────────────────────────────────────────────────────────
// Queue Names — direct queue processing (point-to-point)
// ─────────────────────────────────────────────────────────────

export const Queues = {};

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
};
