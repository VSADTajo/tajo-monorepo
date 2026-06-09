import apiClient from './api';
import type { AlertExecution, AlertRule, AlertTemplate, CreateAlertRuleData, DataSourceInfo, TestQueryResult, TestRuleResult } from '../types/alert.types';

interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

export async function getAlertRules(): Promise<AlertRule[]> {
    const response = await apiClient.get<ApiResponse<AlertRule[]>>('/alerts');
    return response.data.data;
}

export async function getAlertRule(id: string): Promise<AlertRule> {
    const response = await apiClient.get<ApiResponse<AlertRule>>(`/alerts/${id}`);
    return response.data.data;
}

export async function createAlertRule(data: CreateAlertRuleData): Promise<AlertRule> {
    const response = await apiClient.post<ApiResponse<AlertRule>>('/alerts', data);
    return response.data.data;
}

export async function updateAlertRule(id: string, data: Partial<CreateAlertRuleData>): Promise<AlertRule> {
    const response = await apiClient.put<ApiResponse<AlertRule>>(`/alerts/${id}`, data);
    return response.data.data;
}

export async function deleteAlertRule(id: string): Promise<void> {
    await apiClient.delete(`/alerts/${id}`);
}

export async function toggleAlertRule(id: string, enabled: boolean): Promise<AlertRule> {
    const response = await apiClient.patch<ApiResponse<AlertRule>>(`/alerts/${id}/toggle`, { enabled });
    return response.data.data;
}

export async function testAlertRule(id: string): Promise<TestRuleResult> {
    const response = await apiClient.post<ApiResponse<TestRuleResult>>(`/alerts/${id}/test`);
    return response.data.data;
}

export async function testQuery(dataSource: string, query: string): Promise<TestQueryResult> {
    const response = await apiClient.post<ApiResponse<TestQueryResult>>('/alerts/test-query', { dataSource, query });
    return response.data.data;
}

export async function getAlertHistory(id: string, limit = 50, offset = 0): Promise<{ executions: AlertExecution[]; total: number }> {
    const response = await apiClient.get<ApiResponse<{ executions: AlertExecution[]; total: number }>>(`/alerts/${id}/history?limit=${limit}&offset=${offset}`);
    return response.data.data;
}

export async function getAlertTemplates(): Promise<AlertTemplate[]> {
    const response = await apiClient.get<ApiResponse<AlertTemplate[]>>('/alerts/templates');
    return response.data.data;
}

export async function getDataSources(): Promise<DataSourceInfo[]> {
    const response = await apiClient.get<ApiResponse<DataSourceInfo[]>>('/alerts/datasources');
    return response.data.data;
}
