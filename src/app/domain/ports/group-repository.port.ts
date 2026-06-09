import { Group } from '@domain/entities/group.entity';

export abstract class IGroupRepository {
    abstract create(data: Group): Promise<Group>;
    abstract findAll(): Promise<Group[]>;
    abstract findById(id: string): Promise<Group>;
    abstract findByName(name: string): Promise<Group | null>;
    abstract delete(id: string): Promise<void>;
}
