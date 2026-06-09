import { Request, Response } from 'express';
import { ThingsBoardService } from '../services/thingsboard.service';

function getThingsBoardToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

const deviceType = (d: { type?: string; deviceType?: string }) => d.type ?? d.deviceType ?? '';
const isSmcDevice = (dt: string) => {
  const normalized = (dt || '').trim().replace(/\s+/g, '_').toLowerCase();
  return (
    normalized === 'smc_sensor' ||
    normalized === 'smc_alert' ||
    normalized === 'sentilo_sensor'
  );
};

export class InputDataController {
  /** GET /api/input-data/smc/devices - list SMC-capable devices for the device filter select */
  static async getSmcDevices(req: Request, res: Response) {
    try {
      const token = getThingsBoardToken(req);
      if (!token) {
        res.status(401).json({ message: 'Authorization required. Send Bearer token (ThingsBoard JWT).' });
        return;
      }
      const thingsBoardService = new ThingsBoardService(token);
      const devices = await thingsBoardService.getDevices(10000, 0);
      const list: { id: string; name: string; type: string; label: string }[] = [];
      for (const device of devices) {
        const dt = deviceType(device);
        if (!isSmcDevice(dt)) continue;
        const rawLabel = (device as { label?: string }).label;
        const label = (typeof rawLabel === 'string' && rawLabel.trim() !== '')
          ? rawLabel.trim()
          : device.name;
        list.push({
          id: device.id.id,
          name: device.name,
          type: dt,
          label,
        });
      }
      res.json({ devices: list });
    } catch (error) {
      console.error('Error getting SMC devices:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getSmcData(req: Request, res: Response) {
    try {
      const token = getThingsBoardToken(req);
      if (!token) {
        res.status(401).json({ message: 'Authorization required. Send Bearer token (ThingsBoard JWT).' });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 100;
      const station_name = req.query.station_name as string | undefined;
      const sub_basin_name = req.query.sub_basin_name as string | undefined;
      const deviceId = req.query.deviceId as string | undefined;
      const startTsParam = req.query.startTs != null ? parseInt(req.query.startTs as string, 10) : undefined;
      const endTsParam = req.query.endTs != null ? parseInt(req.query.endTs as string, 10) : undefined;

      const thingsBoardService = new ThingsBoardService(token);

      // Default time range: last 24 hours when startTs/endTs not provided
      const now = Date.now();
      const endTs = endTsParam != null && !isNaN(endTsParam) ? endTsParam : now;
      const startTs = startTsParam != null && !isNaN(startTsParam) ? startTsParam : now - 24 * 60 * 60 * 1000;

      // Get all devices
      const allDevices = await thingsBoardService.getDevices(10000, 0);
      const devices = deviceId
        ? allDevices.filter((d) => d.id.id === deviceId)
        : allDevices.filter((d) => isSmcDevice(deviceType(d)));
      
      const results: any[] = [];

      for (const device of devices) {
        const dt = deviceType(device);
        if (!isSmcDevice(dt)) {
          continue;
        }

        // Get device attributes
        const attributes = await thingsBoardService.getDeviceAttributes(device.id.id);
        const attributesMap = attributes.reduce((acc, attr) => {
          acc[attr.key] = attr.value;
          return acc;
        }, {} as Record<string, any>);

        const uxcCode = attributesMap['uxc_code'] ?? attributesMap['station_code'] ?? device.name ?? '';
        const stationCode = attributesMap['station_code'] ?? attributesMap['uxc_code'] ?? device.name ?? '';
        const variableCode = attributesMap['variable_code'];
        const sensorName = attributesMap['sensor_name'] || 'Precipitation';
        const units = attributesMap['units'] || 'mm/h';

        if (!uxcCode && !device.name) {
          continue;
        }

        // Apply filters
        if (station_name && stationCode && stationCode.toLowerCase() !== station_name.toLowerCase()) {
          continue;
        }
        if (sub_basin_name && uxcCode.toLowerCase() !== sub_basin_name.toLowerCase()) {
          continue;
        }

        // Get telemetry data (request common keys in case TB uses different casing)
        const telemetry = await thingsBoardService.getTelemetry(
          device.id.id,
          'value,Value,Precipitation',
          startTs,
          endTs,
          10000
        );

        if (!telemetry || Object.keys(telemetry).length === 0) {
          continue;
        }

        // Process telemetry data
        for (const [key, valueList] of Object.entries(telemetry)) {
          if (!valueList || !Array.isArray(valueList)) {
            continue;
          }

          for (const entry of valueList) {
            if (!entry || typeof entry.ts !== 'number' || entry.value === undefined) {
              continue;
            }

            const numericValue = typeof entry.value === 'number' 
              ? entry.value 
              : parseFloat(String(entry.value));
            
            if (isNaN(numericValue)) {
              continue; // Skip invalid values
            }

            results.push({
              device_id: device.id.id,
              device_name: device.name,
              device_type: dt,
              station_name: stationCode || uxcCode,
              sub_basin_name: uxcCode,
              uxc_code: uxcCode,
              variable_code: variableCode,
              sensor_name: sensorName,
              timestamp: entry.ts,
              value: numericValue,
              units: units,
              key: key,
            });
          }
        }
      }

      // Sort: first by station_name alphabetically, then by timestamp ascending
      results.sort((a, b) => {
        const stationCompare = (a.station_name || '').toLowerCase().localeCompare((b.station_name || '').toLowerCase());
        if (stationCompare !== 0) return stationCompare;
        return a.timestamp - b.timestamp;
      });

      // Paginate
      const total = results.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const paginatedData = results.slice(startIdx, endIdx);

      res.json({
        data: paginatedData,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      });
    } catch (error) {
      console.error('Error getting SMC data:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
