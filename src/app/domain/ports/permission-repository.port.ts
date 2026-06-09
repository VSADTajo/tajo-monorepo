import { Permission } from '@domain/entities/permission.entity';

export abstract class IPermissionRepository {
    abstract create(data: Permission): Promise<Permission>;
    abstract findAll(): Promise<Permission[]>;
    abstract findById(id: string): Promise<Permission>;
    abstract findByMethodAndPath(method: string, path: string): Promise<Permission | null>;
    abstract delete(id: string): Promise<void>;
    abstract upsertMany(
        permissions: Array<{ method: string; path: string; name: string | null; tag: string | null }>,
    ): Promise<Permission[]>;
}
