import { SftpUser } from '@domain/entities/sftp-user.entity';

export abstract class ISftpUserRepository {
    abstract create(user: SftpUser): Promise<SftpUser>;
    abstract findById(id: string): Promise<SftpUser | null>;
    abstract findByUsername(username: string): Promise<SftpUser | null>;
    abstract findAll(): Promise<SftpUser[]>;
    abstract findAllActive(): Promise<SftpUser[]>;
    abstract update(user: SftpUser): Promise<SftpUser>;
    abstract delete(id: string): Promise<void>;
}
