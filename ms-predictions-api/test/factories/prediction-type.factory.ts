export function buildCreatePredictionTypeDto(overrides?: Partial<{ name: string; unit: string }>): {
    name: string;
    unit: string;
} {
    return {
        name: `P.test.forecast.${Date.now()}`,
        unit: 'mm',
        ...overrides,
    };
}
