import { GroupRole } from '@domain/entities/group-role.entity';

export abstract class IGroupRoleRepository {
    abstract create(data: GroupRole): Promise<GroupRole>;
    abstract findByGroupId(groupId: string): Promise<GroupRole[]>;
    abstract findByGroupIdAndRoleId(groupId: string, roleId: string): Promise<GroupRole | null>;
    abstract delete(id: string): Promise<void>;
    abstract deleteByRoleId(roleId: string): Promise<void>;
}
