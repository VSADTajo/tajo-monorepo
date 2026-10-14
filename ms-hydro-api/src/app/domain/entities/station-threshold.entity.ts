import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { Station } from './station.entity';

@Entity('station_thresholds')
export class StationThreshold extends BaseAuditEntity implements IValidable {
    constructor(data?: Partial<StationThreshold>) {
        super();
        if (data) Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false, unique: true })
    stationId: string;

    // ─────────────────────────────────────────────────────────────
    // Tipo de parámetro y señal SAIH
    // ─────────────────────────────────────────────────────────────

    @Column('varchar', { length: 20, nullable: true })
    parametro: string | null;

    @Column('varchar', { length: 20, nullable: true })
    senal: string | null;

    // ─────────────────────────────────────────────────────────────
    // Umbrales de aforo: nivel + caudal (3 niveles)
    // ─────────────────────────────────────────────────────────────

    @Column('double precision', { nullable: true })
    umbralNivel1: number | null;

    @Column('double precision', { nullable: true })
    umbralCaudal1: number | null;

    @Column('double precision', { nullable: true })
    umbralNivel2: number | null;

    @Column('double precision', { nullable: true })
    umbralCaudal2: number | null;

    @Column('double precision', { nullable: true })
    umbralNivel3: number | null;

    @Column('double precision', { nullable: true })
    umbralCaudal3: number | null;

    @Column('double precision', { nullable: true })
    maxNivelMuro: number | null;

    @Column('double precision', { nullable: true })
    maxNivelCaseta: number | null;

    // ─────────────────────────────────────────────────────────────
    // Umbrales de embalse: volumen (3 niveles)
    // ─────────────────────────────────────────────────────────────

    @Column('double precision', { nullable: true })
    umbralVolumen1: number | null;

    @Column('double precision', { nullable: true })
    umbralVolumen2: number | null;

    @Column('double precision', { nullable: true })
    umbralVolumen3: number | null;

    @Column('varchar', { length: 20, nullable: true })
    caudalEntrada: string | null;

    @Column('varchar', { length: 20, nullable: true })
    caudalSalida: string | null;

    @Column('double precision', { nullable: true })
    capacidad: number | null;

    // ─────────────────────────────────────────────────────────────
    // Umbrales de precipitación acumulada en 1h y 12h (3 niveles, mm)
    // ─────────────────────────────────────────────────────────────

    @Column('double precision', { nullable: true })
    umbral1Precip1h: number | null;

    @Column('double precision', { nullable: true })
    umbral2Precip1h: number | null;

    @Column('double precision', { nullable: true })
    umbral3Precip1h: number | null;

    @Column('double precision', { nullable: true })
    umbral1Precip12h: number | null;

    @Column('double precision', { nullable: true })
    umbral2Precip12h: number | null;

    @Column('double precision', { nullable: true })
    umbral3Precip12h: number | null;

    // ─────────────────────────────────────────────────────────────
    // Relación 1:1 con Station
    // ─────────────────────────────────────────────────────────────

    @OneToOne(() => Station, (station) => station.threshold, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'stationId' })
    station: Station;

    validate(): void {
        if (!this.stationId) {
            throw new EntityError('stationId is required', 'stationId');
        }
    }
}
