/**
 * Outbound webhooks: a client registers a URL + the event it cares about (from the backoffice),
 * and ms-logs-api POSTs that URL whenever the matching platform event fires.
 *
 * Events are driven by the `simulation-events` RabbitMQ topic exchange (owned by ms-predictions-api).
 * A subscriber only receives the event it is subscribed to.
 */

// ── Logical events a client can subscribe to (the dropdown in the backoffice) ──
export enum WebhookEvent {
    INPUT_UPLOADED = 'manual_simulation.input_uploaded',
    STATUS_CHANGED = 'manual_simulation.status_changed',
    COMPLETED = 'manual_simulation.completed',
    FAILED = 'manual_simulation.failed',
    BALANCE_COMPUTED = 'manual_simulation.balance_computed',
}

export interface WebhookEventCatalogItem {
    event: WebhookEvent;
    label: string;
    description: string;
}

/** Source of truth for the events the backoffice offers in the subscription form. */
export const WEBHOOK_EVENT_CATALOG: WebhookEventCatalogItem[] = [
    {
        event: WebhookEvent.INPUT_UPLOADED,
        label: 'Input subido al FTP',
        description: 'El fichero de entrada de la simulación manual se subió al FTP y ya se puede recoger.',
    },
    {
        event: WebhookEvent.STATUS_CHANGED,
        label: 'Cambio de estado',
        description: 'La simulación cambió de estado (CREATED, MODEL_PROCESSING, IN_PROGRESS, FINALIZED, MODEL_FAILED).',
    },
    {
        event: WebhookEvent.COMPLETED,
        label: 'Simulación completada',
        description: 'La simulación llegó al estado FINALIZED. Los resultados están disponibles.',
    },
    {
        event: WebhookEvent.FAILED,
        label: 'Simulación fallida',
        description: 'La simulación llegó al estado MODEL_FAILED.',
    },
    {
        event: WebhookEvent.BALANCE_COMPUTED,
        label: 'Balance calculado',
        description: 'El balance de volúmenes de la simulación manual fue calculado.',
    },
];

export const WEBHOOK_EVENTS = WEBHOOK_EVENT_CATALOG.map((e) => e.event) as string[];

// ── Persistence shapes ──
export interface WebhookSubscriptionData {
    url: string;
    event: WebhookEvent;
    active: boolean;
    secret?: string | null;
    description?: string;
}

export interface WebhookDeliveryData {
    subscriptionId: string;
    event: string;
    url: string;
    payload: unknown;
    responseStatus: number | null;
    success: boolean;
    attempts: number;
    error?: string | null;
}

// ── Outbound payload envelope the client receives ──
export interface WebhookPayload {
    event: WebhookEvent;
    occurredAt: string;
    data: Record<string, unknown>;
}
