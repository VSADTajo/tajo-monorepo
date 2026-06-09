interface CreateSubBasinData {
    name: string;
    code: string;
    basinId: string;
    description?: string;
}

export function buildCreateSubBasinDto(
    basinId: string,
    overrides?: Partial<Omit<CreateSubBasinData, 'basinId'>>,
): CreateSubBasinData {
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return {
        name: `SubBasin ${unique}`,
        code: `SB-${unique.substring(0, 10).toUpperCase()}`,
        basinId,
        ...overrides,
    };
}
