import apiClient from '../../api/api';
import type { ExportListResponse, ExportParams, PostExportResponse, PredictionTypeItem } from '../../types/exports';

/** List prediction types (via ms-logs-api -> Predictions API). */
export async function getPredictionTypes(limit = 100): Promise<PredictionTypeItem[]> {
  const { data } = await apiClient.get<PredictionTypeItem[]>('/exports/prediction-types', {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}

/** List CSV files (via ms-logs-api -> Predictions API). */
export async function getExportsFiles(): Promise<ExportListResponse> {
  const { data } = await apiClient.get<ExportListResponse>('/exports/files');
  return data;
}

/** Download existing CSV file by filename. Returns blob for download. */
export async function downloadExportFile(filename: string): Promise<Blob> {
  const response = await apiClient.get(`/exports/files/${encodeURIComponent(filename)}`, {
    responseType: 'blob',
  });
  return response.data;
}

/** Build query string for export params (dates and filters). */
function exportQuery(params: ExportParams, includeMaxRows: boolean): string {
  const q = new URLSearchParams();
  q.set('predicted_by', params.predicted_by);
  q.set('prediction_type', params.prediction_type);
  q.set('prediction_provider', params.prediction_provider);
  q.set('start_date', params.start_date);
  q.set('end_date', params.end_date);
  if (includeMaxRows && params.max_rows != null) q.set('max_rows', String(params.max_rows));
  return q.toString();
}

/** Direct download: generates CSV and returns as blob (up to 100k rows). Goes through ms-logs-api. */
export async function directDownloadExport(params: ExportParams): Promise<Blob> {
  const query = exportQuery(params, true);
  const response = await apiClient.get(`/exports/prediction-results/download?${query}`, {
    responseType: 'blob',
  });
  return response.data;
}

/** Start async export; download later via GET /exports/files/{export_id}. */
export async function postExportAsync(params: ExportParams): Promise<PostExportResponse> {
  const query = exportQuery(params, false);
  const { data } = await apiClient.post<PostExportResponse>(`/exports/prediction-results?${query}`);
  return data;
}
