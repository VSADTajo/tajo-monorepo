import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { RolePermission } from './role-permission.entity';

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

@Entity('permissions')
@Unique('UQ_permission_method_path', ['method', 'path'])
export class Permission extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<Permission>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: true })
    name: string | null;

    @Column('varchar', { length: 10, nullable: false })
    method: string;

    @Column('varchar', { length: 500, nullable: false })
    path: string;

    @Column('varchar', { length: 50, nullable: true })
    tag: string | null;

    @OneToMany(() => RolePermission, (rp) => rp.permission)
    rolePermissions: RolePermission[];

    validate(): void {
        if (!this.method) throw new EntityError('method is required', 'method');
        if (!this.path) throw new EntityError('path is required', 'path');
        this.method = this.method.toUpperCase();
        if (!VALID_METHODS.includes(this.method)) {
            throw new EntityError(`method must be one of: ${VALID_METHODS.join(', ')}`, 'method');
        }
        if (!this.path.startsWith('/')) {
            this.path = `/${this.path}`;
        }
    }
}
