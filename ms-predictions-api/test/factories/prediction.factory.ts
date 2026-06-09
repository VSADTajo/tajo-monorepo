import { v4 as uuidv4 } from 'uuid';

export interface BatchIngestEventDto {
    timestamp: string;
    value: number;
    flag?: number;
}

export interface BatchIngestPredictionDto {
    stationId: string;
    stationName?: string;
    typeName: string;
    units?: string;
    percentile?: number;
    predictionProvider?: string;
    predictedBy?: string;
    events: BatchIngestEventDto[];
}

export interface BatchIngestDto {
    simulationDate: string;
    modmeteo?: string;
    environment?: string;
    type?: string;
    createdBy?: string;
    predictions: BatchIngestPredictionDto[];
}

export function buildBatchIngestDto(overrides?: Partial<BatchIngestDto>): BatchIngestDto {
    const baseDate = new Date('2026-03-10T00:00:00Z');
    return {
        simulationDate: '20260311100000',
        modmeteo: 'WRF',
        environment: 'HEC_HMS_MANUAL',
        type: 'MANUAL',
        createdBy: 'admin',
        predictions: [
            {
                stationId: uuidv4(),
                stationName: 'Test Station',
                typeName: 'Discharge_forecast',
                units: 'm3/s',
                percentile: 50.0,
                predictedBy: 'HEC_HMS_MANUAL',
                events: [
                    { timestamp: baseDate.toISOString(), value: 45.2 },
                    { timestamp: new Date(baseDate.getTime() + 3600000).toISOString(), value: 52.8 },
                ],
            },
        ],
        ...overrides,
    };
}
