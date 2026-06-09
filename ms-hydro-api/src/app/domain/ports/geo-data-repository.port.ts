import { SearchGeoDataResult } from '@domain/results/search-geo-data.result';

export abstract class IGeoDataRepository {
    abstract search(query: string): Promise<SearchGeoDataResult[]>;
}
