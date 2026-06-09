interface IngestionRunData {
    providerConfigId: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    seriesCount: number;
    eventsCount: number;
    errorMessage: string | null;
}

/**
 * Genera datos válidos para crear un ingestion run.
 */
export function buildIngestionRunData(overrides?: Partial<IngestionRunData>): IngestionRunData {
    return {
        providerConfigId: '00000000-0000-0000-0000-000000000000',
        status: 'SUCCESS',
        startedAt: new Date(),
        completedAt: new Date(),
        seriesCount: 10,
        eventsCount: 5760,
        errorMessage: null,
        ...overrides,
    };
}
