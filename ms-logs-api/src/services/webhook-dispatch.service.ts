import crypto from 'crypto';
import axios from 'axios';
import { WebhookService } from './webhook.service';
import { WebhookEvent, WebhookPayload } from '../types/webhook.types';

// ── Source events on the `simulation-events` topic exchange (owned by ms-predictions-api) ──
export const SIMULATION_EVENTS_EXCHANGE = 'simulation-events';

export const SimulationRoutingKeys = {
    MANUAL_DISPATCHED: 'simulation.manual.dispatched',
    STATUS_UPDATED: 'simulation.status.updated',
    MANUAL_BALANCE_COMPUTED: 'simulation.manual.balance.computed',
};

export const WEBHOOK_SOURCE_ROUTING_KEYS = Object.values(SimulationRoutingKeys);

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 10000;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pure mapping: translate an incoming topic message into the logical webhook events it triggers.
 * A single status update can fan out to STATUS_CHANGED plus COMPLETED/FAILED.
 */
export function resolveWebhookEvents(routingKey: string, message: Record<string, unknown>): WebhookEvent[] {
    switch (routingKey) {
        case SimulationRoutingKeys.MANUAL_DISPATCHED:
            return [WebhookEvent.INPUT_UPLOADED];
        case SimulationRoutingKeys.MANUAL_BALANCE_COMPUTED:
            return [WebhookEvent.BALANCE_COMPUTED];
        case SimulationRoutingKeys.STATUS_UPDATED: {
            const events: WebhookEvent[] = [WebhookEvent.STATUS_CHANGED];
            const status = String(message.status ?? '').toUpperCase();
            if (status === 'FINALIZED') events.push(WebhookEvent.COMPLETED);
            if (status === 'MODEL_FAILED') events.push(WebhookEvent.FAILED);
            return events;
        }
        default:
            return [];
    }
}

export class WebhookDispatchService {
    /**
     * Translate an incoming topic message into one or more logical webhook events and dispatch each.
     */
    static async handleIncomingEvent(routingKey: string, message: Record<string, unknown>): Promise<void> {
        const events = resolveWebhookEvents(routingKey, message);
        for (const event of events) {
            await WebhookDispatchService.dispatch(event, message);
        }
    }

    /** Deliver one logical event to every active subscription for it. */
    static async dispatch(event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
        const subscriptions = await WebhookService.findActiveByEvent(event);
        if (subscriptions.length === 0) return;

        const payload: WebhookPayload = { event, occurredAt: new Date().toISOString(), data };
        const body = JSON.stringify(payload);

        // Deliver to all subscribers concurrently so one slow/failing client does not delay the others
        // (and does not hold the RabbitMQ message ack for N × retry-timeout).
        await Promise.allSettled(
            subscriptions.map((sub) => WebhookDispatchService.deliver(sub, event, body, payload))
        );
    }

    private static async deliver(
        sub: { _id: { toString(): string }; url: string; secret?: string | null },
        event: WebhookEvent,
        body: string,
        payload: WebhookPayload
    ): Promise<void> {
        const subscriptionId = sub._id.toString();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
        };
        if (sub.secret) {
            headers['X-Signature'] = `sha256=${crypto.createHmac('sha256', sub.secret).update(body).digest('hex')}`;
        }

        let attempts = 0;
        let responseStatus: number | null = null;
        let success = false;
        let error: string | null = null;

        while (attempts < MAX_ATTEMPTS && !success) {
            attempts += 1;
            try {
                const response = await axios.post(sub.url, body, {
                    headers,
                    timeout: REQUEST_TIMEOUT_MS,
                    validateStatus: () => true,
                    transformRequest: [(d) => d], // body is already a JSON string
                });
                responseStatus = response.status;
                success = response.status >= 200 && response.status < 300;
                if (!success) error = `Non-2xx response: ${response.status}`;
            } catch (err: unknown) {
                error = err instanceof Error ? err.message : 'Unknown delivery error';
            }
            if (!success && attempts < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS);
        }

        await WebhookService.recordDelivery({
            subscriptionId,
            event,
            url: sub.url,
            payload,
            responseStatus,
            success,
            attempts,
            error: success ? null : error,
        });
        await WebhookService.markDelivered(subscriptionId, success ? null : error);

        if (!success) {
            console.error(`Webhook delivery failed for ${sub.url} (event ${event}): ${error}`);
        }
    }
}
