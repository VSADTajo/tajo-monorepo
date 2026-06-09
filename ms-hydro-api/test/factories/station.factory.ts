interface CreateStationData {
    name: string;
    subBasinName: string;
    stationCode: string;
    stationType: string;
    subBasinId: string;
    umbral?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    description?: string;
}

export function buildCreateStationDto(
    subBasinId: string,
    overrides?: Partial<Omit<CreateStationData, 'subBasinId'>>,
): CreateStationData {
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return {
        name: `Station ${unique}`,
        subBasinName: `sub-basin-${unique}`,
        stationCode: `EST-${unique.substring(0, 10).toUpperCase()}`,
        stationType: 'HYDROLOGICAL',
        subBasinId,
        ...overrides,
    };
}
