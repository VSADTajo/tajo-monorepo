import { Schema, model } from 'mongoose';
import { WebhookEvent } from '../types/webhook.types';

const webhookSubscriptionSchema = new Schema(
    {
        url: { type: String, required: true },
        event: { type: String, enum: Object.values(WebhookEvent), required: true },
        active: { type: Boolean, default: true },
        // Optional shared secret used to sign the payload (HMAC-SHA256 → X-Signature header).
        secret: { type: String, default: null },
        description: { type: String, default: '' },
        lastDeliveredAt: { type: Date, default: null },
        lastError: { type: String, default: null },
    },
    { timestamps: true }
);

webhookSubscriptionSchema.index({ active: 1, event: 1 });
// Prevent duplicate subscriptions (same target URL + event) that would double-fire.
webhookSubscriptionSchema.index({ url: 1, event: 1 }, { unique: true });

const WebhookSubscription = model('WebhookSubscription', webhookSubscriptionSchema);

export default WebhookSubscription;
