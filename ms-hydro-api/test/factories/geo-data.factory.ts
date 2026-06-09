interface SearchGeoDataRequest {
    q: string;
}

export function buildSearchGeoDataDto(overrides?: Partial<SearchGeoDataRequest>): SearchGeoDataRequest {
    return {
        q: 'tajo',
        ...overrides,
    };
}
