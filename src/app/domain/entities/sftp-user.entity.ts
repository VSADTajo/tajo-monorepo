import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IValidable } from '@domain/types/validable.type';
import { SftpUsernameValueObject } from '@domain/value-objects/sftp-username.value-object';
import { EntityError } from '@domain/errors/entity.error';

@Entity('sftp_users')
export class SftpUser implements IValidable {
    constructor(data?: Partial<SftpUser>) {
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false, unique: true })
    username: string;

    @Column('varchar', { length: 255, nullable: false })
    password: string;

    @Column('varchar', { length: 500, nullable: false })
    rootDirectory: string;

    @Column('boolean', { nullable: false, default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    validate(): void {
        const usernameVO = new SftpUsernameValueObject(this.username);
        this.username = usernameVO.value;

        if (!this.password || !this.password.trim()) {
            throw new EntityError('Password is required', 'password');
        }

        if (!this.rootDirectory || !this.rootDirectory.trim()) {
            throw new EntityError('Root directory is required', 'rootDirectory');
        }
        this.rootDirectory = this.rootDirectory.trim();
    }
}
