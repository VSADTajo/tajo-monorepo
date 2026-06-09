import apiClient from '../../api/api';
import type { ReportsListParams, ReportsListResponse } from '../../types/reports';

export async function getReports(params?: ReportsListParams): Promise<ReportsListResponse> {
  const search = new URLSearchParams();
  if (params?.provider != null) search.set('provider', params.provider);
  if (params?.simulation_date != null) search.set('simulation_date', params.simulation_date);
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.offset != null) search.set('offset', String(params.offset));
  const response = await apiClient.get<ReportsListResponse>(`/reports?${search.toString()}`);
  return response.data;
}

export async function downloadReport(filename: string): Promise<Blob> {
  const response = await apiClient.get(`/reports/${encodeURIComponent(filename)}`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteReport(filename: string): Promise<void> {
  await apiClient.delete(`/reports/${encodeURIComponent(filename)}`);
}

export async function generateReport(params?: { force?: boolean }): Promise<unknown> {
  const response = await apiClient.post('/reports/generate', {
    force: params?.force ?? false,
  });
  return response.data;
}

