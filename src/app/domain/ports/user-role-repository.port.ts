import { UserRole } from '@domain/entities/user-role.entity';

export abstract class IUserRoleRepository {
    abstract create(data: UserRole): Promise<UserRole>;
    abstract findByUserIdAndRoleId(userId: string, roleId: string): Promise<UserRole | null>;
    abstract findByUserId(userId: string): Promise<UserRole[]>;
    abstract delete(id: string): Promise<void>;
    abstract deleteByRoleId(roleId: string): Promise<void>;
}
