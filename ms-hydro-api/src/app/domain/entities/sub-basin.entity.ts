import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { NameValueObject } from '@domain/value-objects/name.value-object';
import { BasinCodeValueObject } from '@domain/value-objects/basin-code.value-object';
import { EntityError } from '@domain/errors/entity.error';
import { Basin } from './basin.entity';
import { Station } from './station.entity';

@Entity('sub_basins')
export class SubBasin extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<SubBasin>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false })
    name: string;

    @Column('varchar', { length: 20, nullable: false, unique: true })
    code: string;

    @Column('uuid', { nullable: false })
    basinId: string;

    @Column('varchar', { length: 100, nullable: true })
    basinName: string | null;

    @Column('varchar', { length: 255, nullable: true })
    description: string | null;

    @Column('double precision', { nullable: true })
    area: number | null;

    @Column('double precision', { nullable: true })
    perimetro: number | null;

    @Column('double precision', { nullable: true })
    centroidX: number | null;

    @Column('double precision', { nullable: true })
    centroidY: number | null;

    @Column('boolean', { nullable: false, default: true })
    isActive: boolean;

    @ManyToOne(() => Basin, (basin) => basin.subBasins, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'basinId' })
    basin: Basin;

    @OneToMany(() => Station, (station) => station.subBasin)
    stations: Station[];

    validate(): void {
        const name = new NameValueObject(this.name);
        this.name = name.value;

        const code = new BasinCodeValueObject(this.code);
        this.code = code.value;

        if (!this.basinId) throw new EntityError('basinId is required', 'basinId');
    }

    toggleActive(): void {
        this.isActive = !this.isActive;
    }
}
