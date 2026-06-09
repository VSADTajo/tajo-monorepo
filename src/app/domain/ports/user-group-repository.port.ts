import { UserGroup } from '@domain/entities/user-group.entity';

export abstract class IUserGroupRepository {
    abstract create(data: UserGroup): Promise<UserGroup>;
    abstract findByUserId(userId: string): Promise<UserGroup[]>;
    abstract findByUserIdAndGroupId(userId: string, groupId: string): Promise<UserGroup | null>;
    abstract delete(id: string): Promise<void>;
}
