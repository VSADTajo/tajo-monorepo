import { IngestionRun } from '@domain/entities/ingestion-run.entity';

export abstract class IIngestionRunRepository {
    abstract create(data: IngestionRun): Promise<IngestionRun>;
    abstract findById(id: string): Promise<IngestionRun | null>;
    abstract findAll(): Promise<IngestionRun[]>;
    abstract findByProviderConfigId(providerConfigId: string): Promise<IngestionRun[]>;
    abstract findRunningByProviderConfigId(providerConfigId: string): Promise<IngestionRun | null>;
    abstract update(data: IngestionRun): Promise<IngestionRun>;
    abstract deleteOlderThan(date: Date): Promise<number>;
}
