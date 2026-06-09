import { v4 as uuidv4 } from 'uuid';
import {
    IProcessTimeSeriesCommand,
    ITimeSeriesData,
    ITimeSeriesEvent,
} from '../../src/app/application/commands/prediction.commands';

export function buildTimeSeriesEvents(count = 5, overrides?: Partial<ITimeSeriesEvent>): ITimeSeriesEvent[] {
    const baseDate = new Date('2026-03-10T00:00:00Z');
    return Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(baseDate.getTime() + i * 3600000).toISOString(),
        value: Math.round((Math.random() * 100 + 1) * 10) / 10,
        flag: 0,
        isMissing: false,
        ...overrides,
    }));
}

export function buildTimeSeriesData(overrides?: Partial<ITimeSeriesData>): ITimeSeriesData {
    return {
        locationId: uuidv4(),
        parameterId: 'Discharge_forecast',
        moduleInstanceId: 'HEC_HMS_AUTO',
        stationName: `Test Station ${Date.now()}`,
        units: 'm3/s',
        forecastDate: '2026-03-11T10:00:00.000Z',
        startDate: '2026-03-10T00:00:00Z',
        endDate: '2026-03-11T23:00:00Z',
        events: buildTimeSeriesEvents(),
        ...overrides,
    };
}

export function buildProcessTimeSeriesCommand(
    overrides?: Partial<IProcessTimeSeriesCommand>,
): IProcessTimeSeriesCommand {
    return {
        series: buildTimeSeriesData(),
        providerConfigId: uuidv4(),
        providerName: 'WRF',
        providerType: 'FEWS_API',
        ...overrides,
    };
}
