import { User } from '@domain/entities/user.entity';

export abstract class IUserRepository {
    abstract create(data: User): Promise<User>;
    abstract update(data: User): Promise<User>;
    abstract findById(id: string): Promise<User>;
    abstract findByEmail(email: string): Promise<User | null>;
    abstract findAll(): Promise<User[]>;
    abstract delete(id: string): Promise<void>;
}
