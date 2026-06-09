import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { Group } from './group.entity';
import { Role } from './role.entity';

@Entity('group_roles')
@Unique('UQ_group_role', ['groupId', 'roleId'])
export class GroupRole extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<GroupRole>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    groupId: string;

    @ManyToOne(() => Group, (group) => group.groupRoles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'groupId' })
    group: Group;

    @Column('uuid', { nullable: false })
    roleId: string;

    @ManyToOne(() => Role, (role) => role.groupRoles, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'roleId' })
    role: Role;

    validate(): void {
        if (!this.groupId) throw new EntityError('groupId is required', 'groupId');
        if (!this.roleId) throw new EntityError('roleId is required', 'roleId');
    }
}
