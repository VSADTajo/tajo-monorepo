import apiClient from './api';
import type {
    CreateWebhookData,
    WebhookDelivery,
    WebhookEventCatalogItem,
    WebhookSubscription,
} from '../types/webhook.types';

interface ApiResponse<T> {
    success: boolean;
    data: T;
    total?: number;
    error?: string;
}

export async function getWebhookEvents(): Promise<WebhookEventCatalogItem[]> {
    const response = await apiClient.get<ApiResponse<WebhookEventCatalogItem[]>>('/webhooks/events');
    return response.data.data;
}

export async function getWebhooks(): Promise<WebhookSubscription[]> {
    const response = await apiClient.get<ApiResponse<WebhookSubscription[]>>('/webhooks');
    return response.data.data;
}

export async function createWebhook(data: CreateWebhookData): Promise<WebhookSubscription> {
    const response = await apiClient.post<ApiResponse<WebhookSubscription>>('/webhooks', data);
    return response.data.data;
}

export async function updateWebhook(id: string, data: Partial<CreateWebhookData>): Promise<WebhookSubscription> {
    const response = await apiClient.put<ApiResponse<WebhookSubscription>>(`/webhooks/${id}`, data);
    return response.data.data;
}

export async function deleteWebhook(id: string): Promise<void> {
    await apiClient.delete(`/webhooks/${id}`);
}

export async function toggleWebhook(id: string, active: boolean): Promise<WebhookSubscription> {
    const response = await apiClient.patch<ApiResponse<WebhookSubscription>>(`/webhooks/${id}/toggle`, { active });
    return response.data.data;
}

export async function getWebhookDeliveries(subscriptionId?: string): Promise<WebhookDelivery[]> {
    const response = await apiClient.get<ApiResponse<WebhookDelivery[]>>('/webhooks/deliveries', {
        params: subscriptionId ? { subscriptionId } : {},
    });
    return response.data.data;
}
