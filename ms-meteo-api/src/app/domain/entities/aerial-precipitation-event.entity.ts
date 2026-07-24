import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { AerialPrecipitationSeries } from '@domain/entities/aerial-precipitation-series.entity';

/**
 * One row per (seriesId, eventDate) — the hourly event data for a forecast series.
 *
 * No `BaseAuditEntity` extension: this table only has `createdAt`, no `updatedAt`
 * (events are bulk-replaced on re-ingest, never individually updated).
 *
 * Composite PK: (seriesId, eventDate) — enforced at the DB layer.
 * Cascade: ON DELETE CASCADE from the parent series (see migration).
 */
@Entity('aerial_precipitation_events')
export class AerialPrecipitationEvent {
    constructor(data?: Partial<AerialPrecipitationEvent>) {
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryColumn('uuid', { name: 'seriesId' })
    seriesId: string;

    @PrimaryColumn('timestamp', { name: 'eventDate' })
    eventDate: Date;

    @Column('double precision', { nullable: false })
    value: number;

    @Column('smallint', { nullable: false })
    flag: number;

    @CreateDateColumn({ name: 'createdAt' })
    createdAt?: Date;

    // ─── Relation ─────────────────────────────────────────────────

    @ManyToOne(() => AerialPrecipitationSeries, (series) => series.events, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'seriesId' })
    series?: AerialPrecipitationSeries;
}
