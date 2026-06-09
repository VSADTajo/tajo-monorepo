import { Notification } from '@domain/entities/notification.entity';
import { NotificationSeverity } from '@domain/types/notification-severity.enum';
import { NotificationStatus } from '@domain/types/notification-status.enum';

export interface NotificationFilters {
    status?: NotificationStatus[];
    severity?: NotificationSeverity;
    source?: string;
    type?: string;
    fromDate?: Date;
    toDate?: Date;
}

export interface PaginationOptions {
    page: number;
    pageSize: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
}

export abstract class INotificationRepository {
    abstract create(notification: Notification): Promise<Notification>;
    abstract findById(id: string): Promise<Notification | null>;
    abstract findAll(
        filters: NotificationFilters,
        pagination: PaginationOptions,
    ): Promise<PaginatedResult<Notification>>;
    abstract update(notification: Notification): Promise<Notification>;
    abstract updateMany(ids: string[], partial: Partial<Notification>): Promise<number>;
    abstract findByIds(ids: string[]): Promise<Notification[]>;
}
