interface CreateBasinData {
    name: string;
    code: string;
    description?: string;
}

export function buildCreateBasinDto(overrides?: Partial<CreateBasinData>): CreateBasinData {
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return {
        name: `Basin ${unique}`,
        code: `B-${unique.substring(0, 10).toUpperCase()}`,
        ...overrides,
    };
}
