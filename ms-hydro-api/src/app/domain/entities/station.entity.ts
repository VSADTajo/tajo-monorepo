import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { NameValueObject } from '@domain/value-objects/name.value-object';
import { StationCodeValueObject } from '@domain/value-objects/station-code.value-object';
import { EntityError } from '@domain/errors/entity.error';
import { StationType } from '@domain/types/station-type.enum';
import { SubBasin } from './sub-basin.entity';
import { StationThreshold } from './station-threshold.entity';

@Entity('stations')
export class Station extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Station>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false })
    name: string;

    @Column('varchar', { length: 100, nullable: false })
    subBasinName: string;

    @Column('varchar', { length: 50, nullable: false, unique: true })
    stationCode: string;

    @Column({ type: 'enum', enum: StationType, nullable: false })
    stationType: StationType;

    @Column('uuid', { nullable: false })
    subBasinId: string;

    @Column('double precision', { nullable: true })
    latitude: number | null;

    @Column('double precision', { nullable: true })
    longitude: number | null;

    @Column('double precision', { nullable: true })
    altitude: number | null;

    @Column('varchar', { length: 150, nullable: true })
    municipio: string | null;

    @Column('varchar', { length: 100, nullable: true })
    provincia: string | null;

    @Column('varchar', { length: 100, nullable: true })
    ccaa: string | null;

    @Column('varchar', { length: 10, nullable: true })
    tipoCod: string | null;

    @Column('varchar', { length: 100, nullable: true })
    zona: string | null;

    @Column('integer', { nullable: true })
    zonaExplOgcFid: number | null;

    @Column('varchar', { length: 20, nullable: true })
    zonaExplNombre: string | null;

    @Column('varchar', { length: 150, nullable: true })
    comarcaName: string | null;

    @Column('varchar', { length: 100, nullable: true })
    sistemaName: string | null;

    @Column('varchar', { length: 10, nullable: true })
    meteoalertaZonaCode: string | null;

    @Column('varchar', { length: 150, nullable: true })
    meteoalertaZonaNombre: string | null;

    @Column('varchar', { length: 255, nullable: true })
    description: string | null;

    @Column('boolean', { nullable: false, default: true })
    isActive: boolean;

    @ManyToOne(() => SubBasin, (subBasin) => subBasin.stations, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'subBasinId' })
    subBasin: SubBasin;

    @OneToOne(() => StationThreshold, (threshold) => threshold.station, { eager: true })
    threshold: StationThreshold;

    validate(): void {
        const name = new NameValueObject(this.name);
        this.name = name.value;

        const stationCode = new StationCodeValueObject(this.stationCode);
        this.stationCode = stationCode.value;

        this.subBasinName = (this.subBasinName ?? '').trim();
        if (!this.subBasinName) throw new EntityError('subBasinName is required', 'subBasinName');

        if (!this.subBasinId) throw new EntityError('subBasinId is required', 'subBasinId');

        if (!Object.values(StationType).includes(this.stationType)) {
            throw new EntityError('stationType is not a valid StationType value', 'stationType');
        }
    }

    toggleActive(): void {
        this.isActive = !this.isActive;
    }
}
