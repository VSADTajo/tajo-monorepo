export interface WebhookEventCatalogItem {
    event: string;
    label: string;
    description: string;
}

export interface WebhookSubscription {
    _id: string;
    url: string;
    event: string;
    active: boolean;
    secret?: string | null;
    description?: string;
    lastDeliveredAt?: string | null;
    lastError?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWebhookData {
    url: string;
    event: string;
    active?: boolean;
    secret?: string;
    description?: string;
}

export interface WebhookDelivery {
    _id: string;
    subscriptionId: string;
    event: string;
    url: string;
    payload: unknown;
    responseStatus: number | null;
    success: boolean;
    attempts: number;
    error?: string | null;
    createdAt: string;
}
