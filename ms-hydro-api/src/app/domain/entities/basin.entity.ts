import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { NameValueObject } from '@domain/value-objects/name.value-object';
import { BasinCodeValueObject } from '@domain/value-objects/basin-code.value-object';
import { SubBasin } from './sub-basin.entity';

@Entity('basins')
export class Basin extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Basin>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false, unique: true })
    name: string;

    @Column('varchar', { length: 20, nullable: false, unique: true })
    code: string;

    @Column('varchar', { length: 255, nullable: true })
    description: string | null;

    @Column('boolean', { nullable: false, default: true })
    isActive: boolean;

    @OneToMany(() => SubBasin, (subBasin) => subBasin.basin)
    subBasins: SubBasin[];

    validate(): void {
        const name = new NameValueObject(this.name);
        this.name = name.value;

        const code = new BasinCodeValueObject(this.code);
        this.code = code.value;
    }

    toggleActive(): void {
        this.isActive = !this.isActive;
    }
}
