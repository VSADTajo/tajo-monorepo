import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from '@app/infrastructure/persistence/base-entity';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { User } from './user.entity';
import { Group } from './group.entity';

@Entity('user_groups')
@Unique('UQ_user_group', ['userId', 'groupId'])
export class UserGroup extends BaseAuditEntity implements IValidable {
    constructor(data: Partial<UserGroup>) {
        super();
        Object.assign(this, data);
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid', { nullable: false })
    userId: string;

    @ManyToOne(() => User, (user) => user.userGroups, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('uuid', { nullable: false })
    groupId: string;

    @ManyToOne(() => Group, (group) => group.userGroups, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'groupId' })
    group: Group;

    validate(): void {
        if (!this.userId) throw new EntityError('userId is required', 'userId');
        if (!this.groupId) throw new EntityError('groupId is required', 'groupId');
    }
}
