import apiClient from '../../api/api';
import type { HealthStatus, PredictionsApiHealth } from '../../types/health';
import type { LogApiResponse, LogsFilterParams } from '../../types/log';

const PREDICTIONS_API_URL = import.meta.env.VITE_PREDICTIONS_API_URL || 'http://37.27.133.251:8000';
const API_KEY = import.meta.env.VITE_AUTH_API_KEY || '';

/**
 * Get all logs
 */
export async function getAllLogs(): Promise<LogApiResponse[]> {
  try {
    const response = await apiClient.get<LogApiResponse[]>('/logs');
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get filtered logs
 */
export async function getFilteredLogs(params: LogsFilterParams): Promise<LogApiResponse[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.entity) queryParams.append('entity', params.entity);
    if (params.level) queryParams.append('level', params.level);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.correlationId) queryParams.append('correlationId', params.correlationId);
    queryParams.append('_t', Date.now().toString());


    const response = await apiClient.get<LogApiResponse[]>(`/logs/filter?${queryParams.toString()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get logs by entity
 */
export async function getLogsByEntity(entity: string): Promise<LogApiResponse[]> {
  try {
    const response = await apiClient.get<LogApiResponse[]>(`/logs/filter?entity=${entity}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get total count of logs
 */
export async function getTotalLogsCount(): Promise<{ count: number }> {
  try {
    const response = await apiClient.get<{ count: number }>('/logs/count');
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get count of logs by entity
 */
export async function getLogsCountByEntity(entity: string): Promise<{ count: number }> {
  try {
    const response = await apiClient.get<{ count: number }>(`/logs/count/${entity}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get all entities
 */
export async function getAllEntities(): Promise<string[]> {
  try {
    const response = await apiClient.get<string[]>('/logs/entities');
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    const response = await apiClient.get<HealthStatus>('/health');
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get logs count by level for a date range
 */
export async function getLogStats(dateFrom: string, dateTo: string): Promise<{
  info: number;
  warning: number;
  error: number;
  total: number;
}> {
  try {
    const [infoLogs, warningLogs, errorLogs] = await Promise.all([
      apiClient.get<LogApiResponse[]>(`/logs/filter?level=info&dateFrom=${dateFrom}&dateTo=${dateTo}`),
      apiClient.get<LogApiResponse[]>(`/logs/filter?level=warning&dateFrom=${dateFrom}&dateTo=${dateTo}`),
      apiClient.get<LogApiResponse[]>(`/logs/filter?level=error&dateFrom=${dateFrom}&dateTo=${dateTo}`),
    ]);

    return {
      info: infoLogs.data.length,
      warning: warningLogs.data.length,
      error: errorLogs.data.length,
      total: infoLogs.data.length + warningLogs.data.length + errorLogs.data.length,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get Predictions API health status
 */
export async function getPredictionsApiHealth(): Promise<PredictionsApiHealth> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${PREDICTIONS_API_URL}/api/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      headers: {
        ...(API_KEY && { 'x-api-key': API_KEY }),
      },
    });
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'up',
        responseTime,
      };
    } else {
      return {
        status: 'down',
        responseTime,
        details: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'down',
      responseTime,
      details: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

