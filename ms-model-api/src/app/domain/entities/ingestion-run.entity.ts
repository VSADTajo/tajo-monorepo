import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { ProviderConfig } from './provider-config.entity';

@Entity('ingestion_runs')
export class IngestionRun extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<IngestionRun>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    providerConfigId: string;

    @ManyToOne(() => ProviderConfig, (config) => config.ingestionRuns, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'providerConfigId' })
    providerConfig: ProviderConfig;

    @Column('varchar', { length: 20, nullable: false })
    status: string;

    @Column('timestamp', { nullable: false })
    startedAt: Date;

    @Column('timestamp', { nullable: true })
    completedAt: Date | null;

    @Column('integer', { nullable: false, default: 0 })
    seriesCount: number;

    @Column('integer', { nullable: false, default: 0 })
    eventsCount: number;

    @Column('text', { nullable: true })
    errorMessage: string | null;

    validate(): void {
        if (!this.providerConfigId) {
            throw new EntityError('providerConfigId is required', 'providerConfigId');
        }

        if (!this.status) {
            throw new EntityError('status is required', 'status');
        }

        if (!this.startedAt) {
            throw new EntityError('startedAt is required', 'startedAt');
        }
    }
}
