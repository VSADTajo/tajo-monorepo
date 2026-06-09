import { Role } from '@domain/entities/role.entity';

export abstract class IRoleRepository {
    abstract create(data: Role): Promise<Role>;
    abstract findById(id: string): Promise<Role>;
    abstract findByName(name: string): Promise<Role | null>;
    abstract findAll(): Promise<Role[]>;
    abstract delete(id: string): Promise<void>;
}
