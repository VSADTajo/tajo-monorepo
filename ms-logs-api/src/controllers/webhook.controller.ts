import { Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';
import { WEBHOOK_EVENT_CATALOG, WEBHOOK_EVENTS } from '../types/webhook.types';

function param(value: string | string[] | undefined): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value[0] ?? '';
    return '';
}

/** Never expose the shared HMAC secret in API responses. */
function sanitize(sub: unknown): unknown {
    if (!sub || typeof sub !== 'object') return sub;
    const source = typeof (sub as { toObject?: () => object }).toObject === 'function'
        ? (sub as { toObject: () => Record<string, unknown> }).toObject()
        : { ...(sub as Record<string, unknown>) };
    delete (source as Record<string, unknown>).secret;
    return source;
}

// Block webhook targets pointing at internal/private hosts (defense-in-depth against SSRF,
// even though the endpoint is admin-only).
const PRIVATE_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^\[?::1\]?$/,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /\.local$/i,
    /^(infra|ms|vsad)[-.]/i, // internal docker service hostnames
];

/** Returns an error message if the url is invalid or points at an internal host, else null. */
function validateWebhookUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return 'A valid http(s) url is required';
    let host: string;
    try {
        const u = new URL(value);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'A valid http(s) url is required';
        host = u.hostname;
    } catch {
        return 'A valid http(s) url is required';
    }
    if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host)) || !host.includes('.')) {
        return 'Webhook url must be a public host (internal/private addresses are not allowed)';
    }
    return null;
}

export class WebhookController {
    /** Event catalog for the backoffice dropdown. */
    static getEvents(_req: Request, res: Response) {
        res.json({ success: true, data: WEBHOOK_EVENT_CATALOG });
    }

    static async create(req: Request, res: Response) {
        try {
            const { url, event } = req.body;

            const urlError = validateWebhookUrl(url);
            if (urlError) {
                res.status(400).json({ success: false, error: urlError });
                return;
            }
            if (!event || !WEBHOOK_EVENTS.includes(event)) {
                res.status(400).json({ success: false, error: `Invalid event. Valid values: ${WEBHOOK_EVENTS.join(', ')}` });
                return;
            }

            const subscription = await WebhookService.create(req.body);
            res.status(201).json({ success: true, data: sanitize(subscription) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(400).json({ success: false, error: message });
        }
    }

    static async findAll(_req: Request, res: Response) {
        try {
            const subscriptions = await WebhookService.findAll();
            res.json({ success: true, data: subscriptions.map(sanitize) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async findById(req: Request, res: Response) {
        try {
            const subscription = await WebhookService.findById(param(req.params.id));
            if (!subscription) {
                res.status(404).json({ success: false, error: 'Webhook subscription not found' });
                return;
            }
            res.json({ success: true, data: sanitize(subscription) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { url, event } = req.body;
            if (url !== undefined) {
                const urlError = validateWebhookUrl(url);
                if (urlError) {
                    res.status(400).json({ success: false, error: urlError });
                    return;
                }
            }
            if (event !== undefined && !WEBHOOK_EVENTS.includes(event)) {
                res.status(400).json({ success: false, error: `Invalid event. Valid values: ${WEBHOOK_EVENTS.join(', ')}` });
                return;
            }

            const subscription = await WebhookService.update(param(req.params.id), req.body);
            if (!subscription) {
                res.status(404).json({ success: false, error: 'Webhook subscription not found' });
                return;
            }
            res.json({ success: true, data: sanitize(subscription) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(400).json({ success: false, error: message });
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            await WebhookService.delete(param(req.params.id));
            res.json({ success: true });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async toggle(req: Request, res: Response) {
        try {
            const { active } = req.body;
            if (typeof active !== 'boolean') {
                res.status(400).json({ success: false, error: '`active` must be a boolean' });
                return;
            }
            const subscription = await WebhookService.toggle(param(req.params.id), active);
            if (!subscription) {
                res.status(404).json({ success: false, error: 'Webhook subscription not found' });
                return;
            }
            res.json({ success: true, data: sanitize(subscription) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }

    static async listDeliveries(req: Request, res: Response) {
        try {
            const subscriptionId = req.query.subscriptionId ? param(req.query.subscriptionId as string) : undefined;
            const limit = Math.min(Number(req.query.limit) || 50, 100);
            const offset = Number(req.query.offset) || 0;
            const result = await WebhookService.listDeliveries(subscriptionId, limit, offset);
            res.json({ success: true, data: result.deliveries, total: result.total });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ success: false, error: message });
        }
    }
}
