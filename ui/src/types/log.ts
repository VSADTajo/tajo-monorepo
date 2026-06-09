export type LogLevel = 'info' | 'warning' | 'error';

/**
 * Raw API response from backend
 */
export interface LogApiResponse {
  _id: string;
  entity: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  level: LogLevel;
  message: string;
  source?: string | null;
  meta?: Record<string, unknown> | null;
  filePath?: string | null;
  correlationId?: string | null;
}

/**
 * Transformed log entry for UI consumption
 */
export interface LogEntry {
  id: string;
  entity: string;
  timestamp: string; // ISO string (from createdAt)
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  filePath?: string | null;
  correlationId?: string | null;
}

/**
 * Filter parameters for log queries
 */
export interface LogsFilterParams {
  entity?: string;
  level?: LogLevel;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  correlationId?: string;
}

