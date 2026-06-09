/**
 * API calls for Balancer Status panel
 */

const SCHEDULER_API_URL = import.meta.env.VITE_SCHEDULER_API_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_AUTH_API_KEY || '';
const APP_ENV = import.meta.env.VITE_APP_ENV || 'test';

interface StateFileInfo {
  filename: string;
  size: number;
  mtime: string;
  timestamp_from_name: string | null;
}

interface StateFilesResponse {
  path: string;
  files: StateFileInfo[];
  total: number;
}

interface StateFileGroup {
  timestamp: string;
  formatted_timestamp: string;
  files: StateFileInfo[];
  total_size: number;
}

interface GroupedStateFilesResponse {
  path: string;
  groups: StateFileGroup[];
  total_groups: number;
  total_files: number;
}

interface PreHistoricalConfig {
  enabled: boolean;
  pre_historical_hours: number;
  historical_hours: number;
}

interface PreHistoricalConfigUpdateResponse {
  success: boolean;
  config: PreHistoricalConfig;
  message: string;
}

interface StateFilesUploadResponse {
  success: boolean;
  uploaded_count: number;
  message: string;
}

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export async function getStateFiles(path?: string): Promise<StateFilesResponse> {
  const url = path
    ? `${SCHEDULER_API_URL}/api/v1/balancer/states?env=${APP_ENV}&path=${encodeURIComponent(path)}`
    : `${SCHEDULER_API_URL}/api/v1/balancer/states?env=${APP_ENV}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch state files: ${response.statusText}`);
  }
  return response.json();
}

export async function getRootStateFiles(): Promise<StateFilesResponse> {
  const response = await fetch(`${SCHEDULER_API_URL}/api/v1/balancer/states/root?env=${APP_ENV}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch root state files: ${response.statusText}`);
  }
  return response.json();
}

export async function getGroupedStateFiles(location: 'recover' | 'root' = 'recover'): Promise<GroupedStateFilesResponse> {
  const response = await fetch(
    `${SCHEDULER_API_URL}/api/v1/balancer/states/grouped?location=${location}&env=${APP_ENV}`,
    { headers }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch grouped state files: ${response.statusText}`);
  }
  return response.json();
}

export async function downloadStateFiles(timestamp: string, location: 'recover' | 'root' = 'root'): Promise<Blob> {
  const response = await fetch(
    `${SCHEDULER_API_URL}/api/v1/balancer/states/download/${timestamp}?location=${location}&env=${APP_ENV}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  if (!response.ok) {
    throw new Error(`Failed to download state files: ${response.statusText}`);
  }
  return response.blob();
}

export async function uploadStateFiles(
  files: File[],
  location: 'recover' | 'root' = 'root',
  targetTimestamp?: string
): Promise<StateFilesUploadResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  let url = `${SCHEDULER_API_URL}/api/v1/balancer/states/upload?env=${APP_ENV}&location=${location}`;
  if (targetTimestamp) {
    url += `&target_timestamp=${encodeURIComponent(targetTimestamp)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to upload state files: ${response.statusText}`);
  }
  return response.json();
}

export async function getPreHistoricalConfig(): Promise<PreHistoricalConfig> {
  const response = await fetch(`${SCHEDULER_API_URL}/api/v1/balancer/pre-historical/config`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch pre-historical config: ${response.statusText}`);
  }
  return response.json();
}

export async function updatePreHistoricalConfig(
  options: {
    enabled?: boolean;
    pre_historical_hours?: number;
    historical_hours?: number;
  }
): Promise<PreHistoricalConfigUpdateResponse> {
  const response = await fetch(`${SCHEDULER_API_URL}/api/v1/balancer/pre-historical/config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    throw new Error(`Failed to update pre-historical config: ${response.statusText}`);
  }
  return response.json();
}

// ─── Lisflood API ─────────────────────────────────────────────────────────────

export async function getLisfloodGroupedStateFiles(): Promise<GroupedStateFilesResponse> {
  const response = await fetch(
    `${SCHEDULER_API_URL}/api/v1/balancer/lisflood/states/grouped?env=${APP_ENV}`,
    { headers }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch Lisflood state files: ${response.statusText}`);
  }
  return response.json();
}

export async function downloadLisfloodStateFile(timestamp: string): Promise<Blob> {
  const response = await fetch(
    `${SCHEDULER_API_URL}/api/v1/balancer/lisflood/states/download/${timestamp}?env=${APP_ENV}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  if (!response.ok) {
    throw new Error(`Failed to download Lisflood state file: ${response.statusText}`);
  }
  return response.blob();
}

export async function uploadLisfloodStateFile(
  file: File,
  targetTimestamp?: string
): Promise<StateFilesUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  let url = `${SCHEDULER_API_URL}/api/v1/balancer/lisflood/states/upload?env=${APP_ENV}`;
  if (targetTimestamp) {
    url += `&target_timestamp=${encodeURIComponent(targetTimestamp)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to upload Lisflood state file: ${response.statusText}`);
  }
  return response.json();
}

export type {
  StateFileInfo,
  StateFilesResponse,
  StateFileGroup,
  GroupedStateFilesResponse,
  PreHistoricalConfig,
  PreHistoricalConfigUpdateResponse,
  StateFilesUploadResponse,
};
