import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

import { BaseAuditEntity } from '@domain/entities/base-audit.entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { ParameterIdValueObject } from '@domain/value-objects/parameter-id.value-object';
import { LocationIdValueObject } from '@domain/value-objects/location-id.value-object';
import { AerialPrecipitationEvent } from '@domain/entities/aerial-precipitation-event.entity';

/**
 * One row per unique (locationId, parameterId, forecastDate).
 *
 * Stores the full FEWS header plus four derived fields extracted by the
 * ParameterIdValueObject parser.  The natural unique key is enforced at the DB
 * layer via a UNIQUE constraint (see migration).
 */
@Entity('aerial_precipitation_series')
@Unique('UQ_aerial_precip_series_natural_key', ['locationId', 'parameterId', 'forecastDate'])
export class AerialPrecipitationSeries extends BaseAuditEntity implements IValidable {
    constructor(data?: Partial<AerialPrecipitationSeries>) {
        super();
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // ─── Natural key ─────────────────────────────────────────────

    @Column('varchar', { length: 100, nullable: false })
    locationId: string;

    @Column('varchar', { length: 100, nullable: false })
    parameterId: string;

    @Column('timestamp', { nullable: false })
    forecastDate: Date;

    // ─── Derived fields (from ParameterIdValueObject) ─────────────

    @Column('varchar', { length: 20, nullable: false })
    provider: string;

    @Column('varchar', { length: 20, nullable: false })
    layer: string;

    @Column('varchar', { length: 10, nullable: true })
    stat: string | null;

    @Column('varchar', { length: 10, nullable: false })
    accumulation: string;

    // ─── FEWS header fields ───────────────────────────────────────

    @Column('varchar', { length: 100, nullable: true })
    moduleInstanceId: string | null;

    @Column('varchar', { length: 100, nullable: true })
    stationName: string | null;

    @Column('double precision', { nullable: true })
    lat: number | null;

    @Column('double precision', { nullable: true })
    lon: number | null;

    @Column('timestamp', { nullable: true })
    startDate: Date | null;

    @Column('timestamp', { nullable: true })
    endDate: Date | null;

    @Column('varchar', { length: 20, nullable: false, default: 'mm' })
    units: string;

    @Column('double precision', { nullable: false, default: -999 })
    missVal: number;

    @Column('integer', { nullable: false, default: 3600 })
    timeStepSeconds: number;

    @Column('timestamp', { nullable: true })
    creationDate: Date | null;

    @Column('timestamp', { nullable: true })
    approvedDate: Date | null;

    @Column('varchar', { length: 200, nullable: false })
    sourceFileName: string;

    // ─── Relations ────────────────────────────────────────────────

    @OneToMany(() => AerialPrecipitationEvent, (event) => event.series)
    events?: AerialPrecipitationEvent[];

    // ─── Audit columns (BaseAuditEntity override) ─────────────────

    @CreateDateColumn()
    declare createdAt?: Date;

    @UpdateDateColumn()
    declare updatedAt?: Date;

    // ─── Domain invariants ────────────────────────────────────────

    /**
     * Validates the entity and normalizes derived fields from the value objects.
     *
     * Called explicitly by the command handler before persisting — NOT in the
     * constructor so that TypeORM hydration does not trigger validation.
     */
    validate(): void {
        if (!this.locationId) {
            throw new EntityError('locationId is required', 'locationId');
        }
        if (!this.parameterId) {
            throw new EntityError('parameterId is required', 'parameterId');
        }
        if (!this.forecastDate) {
            throw new EntityError('forecastDate is required', 'forecastDate');
        }
        if (!this.sourceFileName) {
            throw new EntityError('sourceFileName is required', 'sourceFileName');
        }

        // Parse and normalize the parameterId
        const paramVo = new ParameterIdValueObject(this.parameterId);

        // Parse and validate the locationId
        const locationVo = new LocationIdValueObject(this.locationId);

        // Cross-check: if the caller pre-filled derived fields, validate consistency
        if (this.provider && this.provider !== paramVo.provider) {
            throw new EntityError(
                `Inconsistent provider: entity has '${this.provider}' but parameterId implies '${paramVo.provider}'`,
                'provider',
            );
        }
        if (this.layer && this.layer !== paramVo.layer) {
            throw new EntityError(
                `Inconsistent layer from parameterId: entity has '${this.layer}' but parameterId implies '${paramVo.layer}'`,
                'layer',
            );
        }
        if (this.layer && this.layer !== locationVo.layer) {
            throw new EntityError(
                `Inconsistent layer from locationId: entity has '${this.layer}' but locationId implies '${locationVo.layer}'`,
                'layer',
            );
        }
        if (this.accumulation && this.accumulation !== paramVo.accumulation) {
            throw new EntityError(
                `Inconsistent accumulation: entity has '${this.accumulation}' but parameterId implies '${paramVo.accumulation}'`,
                'accumulation',
            );
        }

        // Apply normalized values from the VOs
        this.provider = paramVo.provider;
        this.layer = paramVo.layer;
        this.stat = paramVo.stat;
        this.accumulation = paramVo.accumulation;
    }
}
