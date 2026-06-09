import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EmailValueObject } from '@domain/value-objects/email.value-object';
import { NameValueObject } from '@domain/value-objects/name.value-object';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from './user-role.entity';
import { UserGroup } from './user-group.entity';

export enum UserStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

@Entity('users')
export class User extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<User>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { nullable: false })
    name: string;

    @Column('varchar', { nullable: false, unique: true })
    email: string;

    @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
    status: UserStatus;

    @Column('varchar', { nullable: true })
    welcomeEmailId: string | null;

    /** Contraseña (hash, solo para uso interno con AUTH-API). */
    @Column('varchar', { nullable: false })
    password: string;

    @OneToMany(() => UserRole, (userRole) => userRole.user)
    userRoles: UserRole[];

    @OneToMany(() => UserGroup, (ug) => ug.user)
    userGroups: UserGroup[];

    validate(): void {
        const name = new NameValueObject(this.name);
        const email = new EmailValueObject(this.email);
        this.name = name.value;
        this.email = email.value;
    }

    markAsActive(welcomeEmailId: string): void {
        this.status = UserStatus.ACTIVE;
        this.welcomeEmailId = welcomeEmailId;
    }
}
