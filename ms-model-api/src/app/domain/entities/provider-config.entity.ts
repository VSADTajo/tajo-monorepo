import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { ProviderTypeValueObject } from '@domain/value-objects/provider-type.value-object';
import { PollingIntervalValueObject } from '@domain/value-objects/polling-interval.value-object';
import { BaseUrlValueObject } from '@domain/value-objects/base-url.value-object';
import { IngestionRun } from './ingestion-run.entity';

@Entity('provider_configs')
export class ProviderConfig extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<ProviderConfig>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 255, nullable: false, unique: true })
    name: string;

    @Column('varchar', { length: 20, nullable: false })
    type: string;

    @Column('varchar', { length: 500, nullable: false })
    baseUrl: string;

    @Column('integer', { nullable: false, default: 360 })
    pollingIntervalMinutes: number;

    @Column('boolean', { nullable: false, default: false })
    isActive: boolean;

    @Column('jsonb', { nullable: false, default: '{}' })
    settings: Record<string, unknown>;

    @OneToMany(() => IngestionRun, (run) => run.providerConfig)
    ingestionRuns: IngestionRun[];

    validate(): void {
        if (!this.name || this.name.trim().length === 0) {
            throw new EntityError('Provider name is required', 'name');
        }

        this.name = this.name.trim();

        if (this.name.length > 255) {
            throw new EntityError('Provider name must not exceed 255 characters', 'name');
        }

        const providerType = new ProviderTypeValueObject(this.type);
        this.type = providerType.value;

        const baseUrl = new BaseUrlValueObject(this.baseUrl);
        this.baseUrl = baseUrl.value;

        const pollingInterval = new PollingIntervalValueObject(this.pollingIntervalMinutes);
        this.pollingIntervalMinutes = pollingInterval.value;
    }
}
