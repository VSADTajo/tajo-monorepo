import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { BaseAuditEntity } from '@domain/entities/base-audit.entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { IngestStatus, TriggerSource } from '@domain/types/ingest-status.enum';

/**
 * One row per attempt to ingest a single (provider, variable) dataset.
 * Cron and manual triggers both write here. Cycles that find nothing
 * to do also write a row with status='noop' so cycles are never invisible.
 */
@Entity('meteo_ingest_run')
@Index('idx_meteo_ingest_run_provider_variable_started_at', ['provider', 'variable', 'startedAt'])
@Index('idx_meteo_ingest_run_started_at', ['startedAt'])
@Index('idx_meteo_ingest_run_status', ['status'])
export class MeteoIngestRun extends BaseAuditEntity implements IValidable {
    constructor(data?: Partial<MeteoIngestRun>) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 32, nullable: false })
    provider: string;

    @Column('varchar', { length: 64, nullable: true })
    variable: string | null;

    @Column('timestamptz', { nullable: true, name: 'forecast_run' })
    forecastRun: Date | null;

    @Column('integer', { default: 0, name: 'files_processed' })
    filesProcessed: number;

    @Column('integer', { default: 0, name: 'files_ok' })
    filesOk: number;

    @Column('integer', { default: 0, name: 'files_failed' })
    filesFailed: number;

    @Column('varchar', { length: 16, nullable: false })
    status: IngestStatus;

    @Column('varchar', { length: 16, nullable: false, name: 'triggered_by' })
    triggeredBy: TriggerSource;

    @Column('timestamptz', { nullable: false, name: 'started_at' })
    startedAt: Date;

    @Column('timestamptz', { nullable: true, name: 'finished_at' })
    finishedAt: Date | null;

    @Column('text', { nullable: true, name: 'error_summary' })
    errorSummary: string | null;

    @CreateDateColumn({ name: 'created_at' })
    declare createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    declare updatedAt: Date;

    // ─────────────────────────────────────────────────────────────
    // Domain invariants
    // ─────────────────────────────────────────────────────────────

    validate(): void {
        if (!this.provider) {
            throw new EntityError('provider is required', 'provider');
        }
        if (!Object.values(IngestStatus).includes(this.status)) {
            throw new EntityError(`invalid status: ${this.status}`, 'status');
        }
        if (!Object.values(TriggerSource).includes(this.triggeredBy)) {
            throw new EntityError(`invalid triggeredBy: ${this.triggeredBy}`, 'triggeredBy');
        }
        if (this.filesProcessed < 0 || this.filesOk < 0 || this.filesFailed < 0) {
            throw new EntityError('file counters must be non-negative');
        }
        if (this.filesProcessed !== this.filesOk + this.filesFailed) {
            throw new EntityError(
                `files_processed (${this.filesProcessed}) must equal files_ok (${this.filesOk}) + files_failed (${this.filesFailed})`,
            );
        }
        if (!this.startedAt) {
            throw new EntityError('startedAt is required', 'startedAt');
        }
    }

    // ─────────────────────────────────────────────────────────────
    // State transitions
    // ─────────────────────────────────────────────────────────────

    markRunning(): void {
        this.status = IngestStatus.RUNNING;
        this.startedAt = this.startedAt ?? new Date();
        this.finishedAt = null;
        this.filesProcessed = 0;
        this.filesOk = 0;
        this.filesFailed = 0;
        this.errorSummary = null;
    }

    markOk(filesOk: number): void {
        this.filesOk = filesOk;
        this.filesFailed = 0;
        this.filesProcessed = filesOk;
        this.status = IngestStatus.OK;
        this.finishedAt = new Date();
        this.errorSummary = null;
    }

    markPartial(filesOk: number, filesFailed: number, errorSummary: string): void {
        this.filesOk = filesOk;
        this.filesFailed = filesFailed;
        this.filesProcessed = filesOk + filesFailed;
        this.status = IngestStatus.PARTIAL;
        this.finishedAt = new Date();
        this.errorSummary = errorSummary;
    }

    markFailed(errorSummary: string): void {
        this.filesProcessed = this.filesOk + this.filesFailed;
        this.status = IngestStatus.FAILED;
        this.finishedAt = new Date();
        this.errorSummary = errorSummary;
    }

    markNoop(): void {
        this.filesProcessed = 0;
        this.filesOk = 0;
        this.filesFailed = 0;
        this.status = IngestStatus.NOOP;
        this.finishedAt = new Date();
        this.errorSummary = null;
    }
}
