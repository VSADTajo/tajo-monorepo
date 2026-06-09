import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { Organismo } from '@domain/types/organismo.enum';
import { Station } from './station.entity';

@Entity('station_resguardos')
@Unique('UQ_station_resguardos_station_date', ['stationId', 'date'])
export class StationResguardo extends BaseAuditEntity implements IValidable {
    constructor(data?: Partial<StationResguardo>) {
        super();
        if (data) Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    stationId: string;

    @Column('date', { nullable: false })
    date: string;

    @Column({ type: 'enum', enum: Organismo, nullable: false, default: Organismo.EXPLOTACION })
    organismo: Organismo;

    // ─────────────────────────────────────────────────────────────
    // Original values (immutable post-import)
    // ─────────────────────────────────────────────────────────────

    @Column('double precision', { nullable: true })
    originalReserveVolume: number | null;

    @Column('double precision', { nullable: true })
    originalReserveLevel: number | null;

    @Column('double precision', { nullable: true })
    originalMinimumVolume: number | null;

    // ─────────────────────────────────────────────────────────────
    // Edited values (null = use original)
    // ─────────────────────────────────────────────────────────────

    @Column('double precision', { nullable: true })
    reserveVolume: number | null;

    @Column('double precision', { nullable: true })
    reserveLevel: number | null;

    @Column('double precision', { nullable: true })
    minimumVolume: number | null;

    // ─────────────────────────────────────────────────────────────
    // Relation N:1 with Station
    // ─────────────────────────────────────────────────────────────

    @ManyToOne(() => Station, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'stationId' })
    station: Station;

    validate(): void {
        if (!this.stationId) {
            throw new EntityError('stationId is required', 'stationId');
        }
        if (!this.date) {
            throw new EntityError('date is required', 'date');
        }
        if (!Object.values(Organismo).includes(this.organismo)) {
            throw new EntityError('organismo is not a valid Organismo value', 'organismo');
        }
    }
}
