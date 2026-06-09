import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

interface ThingsBoardConfig {
  host: string;
  port: number;
}

interface DeviceInfo {
  id: {
    id: string;
    entityType: string;
  };
  name: string;
  type?: string;
  deviceType?: string;
}

interface DeviceAttribute {
  key: string;
  value: any;
}

interface TelemetryEntry {
  ts: number;
  value: number | string;
}

interface TelemetryData {
  [key: string]: TelemetryEntry[];
}

export class ThingsBoardService {
  private restClient: AxiosInstance;
  private token: string | null;

  /**
   * @param thingsBoardToken - Token JWT de ThingsBoard (el que envía el front desde localStorage).
   */
  constructor(thingsBoardToken?: string) {
    this.token = thingsBoardToken ?? null;
    const host = process.env.THINGSBOARD_HOST;
    const port = process.env.THINGSBOARD_REST_API_PORT;

    this.restClient = axios.create({
      baseURL: `http://${host}:${port}`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.restClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      if (this.token && config.headers) {
        config.headers['X-Authorization'] = `Bearer ${this.token}`;
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
      }
      return config;
    });

    this.restClient.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => Promise.reject(error)
    );
  }

  async getDevices(pageSize: number = 10000, page: number = 0): Promise<DeviceInfo[]> {
    try {
      const response = await this.restClient.get('/api/tenant/deviceInfos', {
        params: {
          pageSize,
          page,
        },
      });
      const body = response.data;
      if (Array.isArray(body)) return body;
      if (body?.data != null) {
        const data = body.data;
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object' && Array.isArray(data.data)) return data.data;
      }
      if (body?.devices && Array.isArray(body.devices)) return body.devices;
      return [];
    } catch (error) {
      console.error('Error fetching devices:', error);
      throw error;
    }
  }

  async getDeviceAttributes(deviceId: string): Promise<DeviceAttribute[]> {
    try {
      const response = await this.restClient.get(
        `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`
      );
      const data = response.data;
      // ThingsBoard can return either { "key": value, ... } or [ { key, value }, ... ]
      if (Array.isArray(data)) {
        return data
          .filter((item: any) => item && typeof item === 'object')
          .map((item: any) => ({ key: item.key, value: item.value }));
      }
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return Object.entries(data).map(([key, value]) => ({ key, value }));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching attributes for device ${deviceId}:`, error);
      return [];
    }
  }

  async getTelemetry(
    deviceId: string,
    keys: string,
    startTs: number,
    endTs: number,
    limit: number = 10000
  ): Promise<TelemetryData> {
    try {
      const keysArray = keys.split(',').map((k) => k.trim());
      const response = await this.restClient.get(
        `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
        {
          params: {
            keys: keysArray.join(','),
            startTs,
            endTs,
            limit,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching telemetry for device ${deviceId}:`, error);
      return {};
    }
  }
}
