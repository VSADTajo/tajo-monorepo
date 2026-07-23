import WebhookSubscription from '../collections/webhook-subscription.collection';
import WebhookDelivery from '../collections/webhook-delivery.collection';
import { WebhookDeliveryData, WebhookEvent, WebhookSubscriptionData } from '../types/webhook.types';

export class WebhookService {
    static async create(data: WebhookSubscriptionData) {
        return WebhookSubscription.create(data);
    }

    static async findAll() {
        return WebhookSubscription.find().sort({ createdAt: -1 });
    }

    static async findById(id: string) {
        return WebhookSubscription.findById(id);
    }

    static async update(id: string, data: Partial<WebhookSubscriptionData>) {
        return WebhookSubscription.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }

    static async delete(id: string) {
        await WebhookSubscription.findByIdAndDelete(id);
        await WebhookDelivery.deleteMany({ subscriptionId: id });
    }

    static async toggle(id: string, active: boolean) {
        return WebhookSubscription.findByIdAndUpdate(id, { active }, { new: true });
    }

    /** Active subscriptions for a given event — used by the dispatcher. */
    static async findActiveByEvent(event: WebhookEvent) {
        return WebhookSubscription.find({ active: true, event });
    }

    static async recordDelivery(data: WebhookDeliveryData) {
        return WebhookDelivery.create(data);
    }

    static async markDelivered(id: string, error: string | null) {
        await WebhookSubscription.findByIdAndUpdate(id, { lastDeliveredAt: new Date(), lastError: error });
    }

    static async listDeliveries(subscriptionId: string | undefined, limit = 50, offset = 0) {
        const filter = subscriptionId ? { subscriptionId } : {};
        const [deliveries, total] = await Promise.all([
            WebhookDelivery.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
            WebhookDelivery.countDocuments(filter),
        ]);
        return { deliveries, total };
    }
}
