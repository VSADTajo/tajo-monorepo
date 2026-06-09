import { Column, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { User } from './user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
export class UserRole extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<UserRole>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    userId: string;

    @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('uuid', { nullable: false })
    roleId: string;

    @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'roleId' })
    role: Role;

    validate(): void {
        if (!this.userId) {
            throw new EntityError('userId is required', 'userId');
        }
        if (!this.roleId) {
            throw new EntityError('roleId is required', 'roleId');
        }
    }
}
