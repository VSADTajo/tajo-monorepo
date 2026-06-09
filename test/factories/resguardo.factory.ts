export interface CreateResguardoData {
    stationCode: string;
    date: string;
    originalReserveVolume: number | null;
    originalReserveLevel: number | null;
    originalMinimumVolume: number | null;
}

export function buildResguardoEntries(
    stationCode: string,
    count: number = 3,
    overrides?: Partial<Omit<CreateResguardoData, 'stationCode'>>,
): CreateResguardoData[] {
    const entries: CreateResguardoData[] = [];
    for (let i = 0; i < count; i++) {
        const day = String(i + 1).padStart(2, '0');
        entries.push({
            stationCode,
            date: `2025-10-${day}`,
            originalReserveVolume: 800 + i * 10,
            originalReserveLevel: 700 + i,
            originalMinimumVolume: 50 + i,
            ...overrides,
        });
    }
    return entries;
}
