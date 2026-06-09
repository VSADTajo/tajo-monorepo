import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { GroupRole } from './group-role.entity';
import { UserGroup } from './user-group.entity';

@Entity('groups')
export class Group extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Group>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 50, nullable: false, unique: true })
    name: string;

    @Column('varchar', { length: 255, nullable: true })
    description: string | null;

    @OneToMany(() => GroupRole, (gr) => gr.group)
    groupRoles: GroupRole[];

    @OneToMany(() => UserGroup, (ug) => ug.group)
    userGroups: UserGroup[];

    validate(): void {
        if (!this.name) throw new EntityError('name is required', 'name');
        this.name = this.name.trim().toLowerCase();
        if (this.name.length > 50) throw new EntityError('name must be at most 50 characters', 'name');
        if (!/^[a-z0-9_-]+$/.test(this.name)) {
            throw new EntityError('name must contain only lowercase alphanumeric, hyphens, and underscores', 'name');
        }
    }
}
