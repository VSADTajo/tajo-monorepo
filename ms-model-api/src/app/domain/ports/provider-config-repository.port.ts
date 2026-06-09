import { ProviderConfig } from '@domain/entities/provider-config.entity';

export abstract class IProviderConfigRepository {
    abstract create(data: ProviderConfig): Promise<ProviderConfig>;
    abstract findAll(): Promise<ProviderConfig[]>;
    abstract findById(id: string): Promise<ProviderConfig | null>;
    abstract findByName(name: string): Promise<ProviderConfig | null>;
    abstract findActive(): Promise<ProviderConfig[]>;
    abstract update(data: ProviderConfig): Promise<ProviderConfig>;
    abstract delete(id: string): Promise<void>;
}
