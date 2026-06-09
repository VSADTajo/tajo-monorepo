import axios from 'axios';

// API URLs
const SCHEDULER_API_URL = import.meta.env.VITE_SCHEDULER_API_URL || 'http://localhost:8001';
const MS_LOGS_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_AUTH_API_KEY || '';

// API clients
const schedulerApi = axios.create({
  baseURL: `${SCHEDULER_API_URL}/api/v1/predictions-info`,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'x-api-key': API_KEY }),
  },
});

const msLogsApi = axios.create({
  baseURL: MS_LOGS_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor for ms-logs-api
msLogsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface SmcDataPoint {
  device_id: string;
  device_name: string;
  device_type: 'SMC_Sensor' | 'SMC_Alert';
  station_name: string;
  sub_basin_name: string;
  uxc_code: string;
  variable_code?: string;
  sensor_name: string;
  timestamp: number; // milliseconds
  value: number;
  units: string;
  key: string;
}

/** WRF / ECMWF prediction row from scheduler (parquet) */
export interface PredictionDataPoint {
  id: string;
  station_name: string;
  sub_basin_name: string;
  prediction_provider: 'WRF' | 'ECMWF';
  ensemble: string;
  simulation_date: string;
  prediction_type: string;
  date_timestamp: number; // seconds
  value: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Respuesta paginada de WRF / ECMWF (scheduler parquet) */
export interface PredictionDataResponse {
  data: PredictionDataPoint[];
  pagination: PaginationInfo;
}

/** Respuesta paginada de Thingsboard Data (ms-logs-api → ThingsBoard) */
export interface SmcDataResponse {
  data: SmcDataPoint[];
  pagination: PaginationInfo;
}

/** Dispositivo Thingsboard Data para el select (lista de dispositivos) */
export interface SmcDevice {
  id: string;
  name: string;
  type: string;
  label: string;
}

export interface SmcDevicesResponse {
  devices: SmcDevice[];
}

// API Functions

/**
 * Lista de dispositivos Thingsboard Data para el filtro por dispositivo.
 */
export async function getSmcDevices(): Promise<SmcDevicesResponse> {
  const response = await msLogsApi.get('/api/input-data/smc/devices');
  return response.data;
}

/**
 * Obtener datos Thingsboard Data desde ThingsBoard (backend de ms-logs-api).
 * deviceId: si se envía, solo se devuelve telemetría de ese dispositivo.
 * startTs/endTs en ms; si no se envían, el backend usa últimas 24 h.
 */
export async function getSmcData(
  page: number = 1,
  pageSize: number = 100,
  station_name?: string,
  sub_basin_name?: string,
  startTs?: number,
  endTs?: number,
  deviceId?: string
): Promise<SmcDataResponse> {
  const params: Record<string, string | number> = { page, pageSize };
  if (station_name) params.station_name = station_name;
  if (sub_basin_name) params.sub_basin_name = sub_basin_name;
  if (startTs != null) params.startTs = startTs;
  if (endTs != null) params.endTs = endTs;
  if (deviceId) params.deviceId = deviceId;

  const response = await msLogsApi.get('/api/input-data/smc', { params });
  return response.data;
}

/**
 * Obtener datos WRF desde scheduler-v2 (archivos parquet)
 * Usa el endpoint con format=JSON para obtener datos paginados
 */
export async function getWrfData(
  page: number = 1,
  pageSize: number = 100,
  station_name?: string,
  sub_basin_name?: string,
  simulation_date?: string
): Promise<PredictionDataResponse> {
  const params: any = {
    format: 'JSON',
    page,
    pageSize,
  };
  if (station_name) params.station_name = station_name;
  if (sub_basin_name) params.sub_basin_name = sub_basin_name;
  if (simulation_date) params.simulation_date = simulation_date;
  
  const response = await schedulerApi.get('/latest-predictions/WRF', { params });
  return response.data;
}

/**
 * Obtener datos ECMWF desde scheduler-v2 (archivos parquet)
 * Usa el endpoint con format=JSON para obtener datos paginados
 */
export async function getEcmwfData(
  ensemble: string = '000',
  page: number = 1,
  pageSize: number = 100,
  station_name?: string,
  sub_basin_name?: string,
  simulation_date?: string
): Promise<PredictionDataResponse> {
  const params: any = {
    format: 'JSON',
    page,
    pageSize,
  };
  if (station_name) params.station_name = station_name;
  if (sub_basin_name) params.sub_basin_name = sub_basin_name;
  if (simulation_date) params.simulation_date = simulation_date;
  
  const response = await schedulerApi.get(`/latest-predictions-by-ensemble/ECMWF/${ensemble}`, { params });
  return response.data;
}
