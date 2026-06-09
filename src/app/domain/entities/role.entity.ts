import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { RoleNameValueObject } from '@domain/value-objects/role-name.value-object';
import { UserRole } from './user-role.entity';
import { RolePermission } from './role-permission.entity';
import { GroupRole } from './group-role.entity';

@Entity('roles')
export class Role extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Role>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 50, nullable: false, unique: true })
    name: string;

    @Column('varchar', { length: 255, nullable: true })
    description: string | null;

    @OneToMany(() => UserRole, (userRole) => userRole.role)
    userRoles: UserRole[];

    @OneToMany(() => RolePermission, (rp) => rp.role)
    rolePermissions: RolePermission[];

    @OneToMany(() => GroupRole, (gr) => gr.role)
    groupRoles: GroupRole[];

    validate(): void {
        const roleName = new RoleNameValueObject(this.name);
        this.name = roleName.value;
    }
}
