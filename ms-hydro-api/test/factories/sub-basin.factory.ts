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
    const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return {
        name: `SubBasin ${unique}`,
        code: `SB-${unique.toUpperCase()}`,
        basinId,
        ...overrides,
    };
}
