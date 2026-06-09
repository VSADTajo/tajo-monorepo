import { RolePermission } from '@domain/entities/role-permission.entity';

export abstract class IRolePermissionRepository {
    abstract findByRoleId(roleId: string): Promise<RolePermission[]>;
    abstract findByRoleNames(roleNames: string[]): Promise<RolePermission[]>;
    abstract syncForRole(roleId: string, permissionIds: string[]): Promise<RolePermission[]>;
    abstract hasAssignments(permissionId: string): Promise<boolean>;
}
