import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { NormalizedTimeSeriesResult } from '@domain/results/normalized-timeseries.result';

export abstract class IDataProvider {
    abstract fetch(config: ProviderConfig): Promise<NormalizedTimeSeriesResult[]>;
}
