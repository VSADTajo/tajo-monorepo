// ─────────────────────────────────────────────────────────────
// Queue Names — direct queue processing (point-to-point)
// ─────────────────────────────────────────────────────────────

export const Queues = {
    MODEL_SIMULATION_DISPATCHED: 'model-simulation-dispatched',
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
            MANUAL_OUTPUT_FETCHED: 'simulation.manual.output.fetched',
            STATUS_UPDATED: 'simulation.status.updated',
        },
    },
};
