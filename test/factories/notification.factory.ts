import { v4 as uuidv4 } from 'uuid';

export function buildNotificationData(
    overrides?: Partial<{
        stationId: string;
        predictionResultId: number;
        thresholdValue: number;
        actualValue: number;
    }>,
) {
    return {
        stationId: uuidv4(),
        predictionResultId: 1,
        thresholdValue: 50.0,
        actualValue: 80.0,
        ...overrides,
    };
}
