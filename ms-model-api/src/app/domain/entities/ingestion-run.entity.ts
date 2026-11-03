import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { IngestionStatus } from '@domain/types/ingestion-status.enum';
import { ProviderConfig } from './provider-config.entity';

/**
 * A run still RUNNING after this long was orphaned: the process died mid-fetch
 * (restart, deploy, crash) and nothing will ever close it. Real ingestions take
 * seconds to a few minutes, so two hours leaves a wide margin while costing at
 * most two hourly cycles.
 */
export const INGESTION_RUN_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

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

    isStale(now: Date): boolean {
        return (
            this.status === IngestionStatus.RUNNING &&
            now.getTime() - new Date(this.startedAt).getTime() > INGESTION_RUN_STALE_AFTER_MS
        );
    }

    markAsInterrupted(now: Date): void {
        this.status = IngestionStatus.FAILED;
        this.completedAt = now;
        this.errorMessage =
            `Interrupted: still RUNNING since ${new Date(this.startedAt).toISOString()} ` +
            '(the process stopped mid-ingestion); released by a newer ingestion';
    }

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
