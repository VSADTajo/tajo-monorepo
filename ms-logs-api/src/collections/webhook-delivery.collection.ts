import { Schema, model } from 'mongoose';

const webhookDeliverySchema = new Schema(
    {
        subscriptionId: { type: String, required: true, index: true },
        event: { type: String, required: true },
        url: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, default: null },
        responseStatus: { type: Number, default: null },
        success: { type: Boolean, default: false },
        attempts: { type: Number, default: 0 },
        error: { type: String, default: null },
    },
    { timestamps: true }
);

webhookDeliverySchema.index({ createdAt: -1 });

const WebhookDelivery = model('WebhookDelivery', webhookDeliverySchema);

export default WebhookDelivery;
