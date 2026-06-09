import { MeteoIngestRun } from '@domain/entities/meteo-ingest-run.entity';

/**
 * Composite key for "the latest run for a (provider, variable)" lookups.
 * variable is null for providers without a variable level (RADAR).
 */
export interface DatasetKey {
    provider: string;
    variable: string | null;
}

export abstract class IMeteoIngestRunRepository {
    abstract create(run: MeteoIngestRun): Promise<MeteoIngestRun>;
    abstract update(run: MeteoIngestRun): Promise<MeteoIngestRun>;
    abstract findLatestByDataset(provider: string, variable: string | null): Promise<MeteoIngestRun | null>;
    /**
     * Returns the latest run for every (provider, variable) that has at least one row.
     * Map key is `${provider}::${variable ?? ''}`.
     */
    abstract findLatestForAll(): Promise<Map<string, MeteoIngestRun>>;
}

export function datasetMapKey(provider: string, variable: string | null): string {
    return `${provider}::${variable ?? ''}`;
}
