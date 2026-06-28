interface CreateBasinData {
    name: string;
    code: string;
    description?: string;
}

export function buildCreateBasinDto(overrides?: Partial<CreateBasinData>): CreateBasinData {
    const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return {
        name: `Basin ${unique}`,
        code: `B-${unique.toUpperCase()}`,
        ...overrides,
    };
}
