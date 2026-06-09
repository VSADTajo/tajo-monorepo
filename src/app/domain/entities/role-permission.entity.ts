import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
@Unique('UQ_role_permission', ['roleId', 'permissionId'])
export class RolePermission extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<RolePermission>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    roleId: string;

    @ManyToOne(() => Role, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'roleId' })
    role: Role;

    @Column('uuid', { nullable: false })
    permissionId: string;

    @ManyToOne(() => Permission, (p) => p.rolePermissions, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'permissionId' })
    permission: Permission;

    validate(): void {
        if (!this.roleId) throw new EntityError('roleId is required', 'roleId');
        if (!this.permissionId) throw new EntityError('permissionId is required', 'permissionId');
    }
}
