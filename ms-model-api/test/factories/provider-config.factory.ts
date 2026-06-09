interface CreateProviderConfigData {
    name: string;
    type: string;
    baseUrl: string;
    pollingIntervalMinutes: number;
    settings: Record<string, unknown>;
}

/**
 * Genera datos válidos para crear un provider config.
 * Cada llamada produce un nombre único.
 */
export function buildCreateProviderConfigDto(overrides?: Partial<CreateProviderConfigData>): CreateProviderConfigData {
    return {
        name: `provider-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'FEWS_API',
        baseUrl: 'https://fews.example.com/rest/fewspiservice/v1',
        pollingIntervalMinutes: 60,
        settings: {
            filterId: 'NAM_EPS',
            locationIds: ['AR01', 'AR02'],
            parameterIds: ['Q.NAM.ens.Med'],
            documentFormat: 'PI_JSON',
        },
        ...overrides,
    };
}

export function buildCreateCsvProviderConfigDto(
    overrides?: Partial<CreateProviderConfigData>,
): CreateProviderConfigData {
    return {
        name: `csv-provider-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'CSV_FILE',
        baseUrl: 'http://ms-sftp-api:3003',
        pollingIntervalMinutes: 360,
        settings: {
            filePath: '/test/csv',
            filePrefix: 'Tagus_FlowCast',
        },
        ...overrides,
    };
}
