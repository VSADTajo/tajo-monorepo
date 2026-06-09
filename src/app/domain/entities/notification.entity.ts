import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IValidable } from '@domain/types/validable.type';
import { EntityError } from '@domain/errors/entity.error';
import { NotificationSeverity } from '@domain/types/notification-severity.enum';
import { NotificationStatus } from '@domain/types/notification-status.enum';

@Entity('notifications')
export class Notification implements IValidable {
    constructor(data?: Partial<Notification>) {
        if (data) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, nullable: false })
    type: string;

    @Column('varchar', { length: 100, nullable: false })
    source: string;

    @Column('varchar', { length: 255, nullable: false })
    title: string;

    @Column('text', { nullable: false })
    message: string;

    @Column('jsonb', { nullable: true, default: '{}' })
    metadata: Record<string, unknown>;

    @Column({ type: 'enum', enum: NotificationSeverity, nullable: false })
    severity: NotificationSeverity;

    @Column({ type: 'enum', enum: NotificationStatus, nullable: false, default: NotificationStatus.UNREAD })
    status: NotificationStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    validate(): void {
        if (!this.type || !this.type.trim()) {
            throw new EntityError('Type is required', 'type');
        }
        if (this.type.length > 100) {
            throw new EntityError('Type must be at most 100 characters', 'type');
        }
        this.type = this.type.trim();

        if (!this.source || !this.source.trim()) {
            throw new EntityError('Source is required', 'source');
        }
        if (this.source.length > 100) {
            throw new EntityError('Source must be at most 100 characters', 'source');
        }
        this.source = this.source.trim();

        if (!this.title || !this.title.trim()) {
            throw new EntityError('Title is required', 'title');
        }
        if (this.title.length > 255) {
            throw new EntityError('Title must be at most 255 characters', 'title');
        }
        this.title = this.title.trim();

        if (!this.message || !this.message.trim()) {
            throw new EntityError('Message is required', 'message');
        }

        if (this.metadata) {
            const metadataStr = JSON.stringify(this.metadata);
            if (metadataStr.length > 10240) {
                throw new EntityError('Metadata must be at most 10KB', 'metadata');
            }
        }

        if (!Object.values(NotificationSeverity).includes(this.severity)) {
            throw new EntityError('Invalid severity value', 'severity');
        }
    }
}
