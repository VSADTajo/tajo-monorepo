import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Logger } from 'nestjs-pino';

import {
    INotificationRepository,
    NotificationFilters,
    PaginationOptions,
    PaginatedResult,
} from '@domain/ports/notification-repository.port';
import { Notification } from '@domain/entities/notification.entity';
import { RepositoryError } from '@domain/errors/repository.error';

@Injectable()
export class NotificationRepository implements INotificationRepository {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        @InjectRepository(Notification)
        private readonly repository: Repository<Notification>,
    ) {}

    async create(notification: Notification): Promise<Notification> {
        try {
            return await this.repository.save(notification);
        } catch (error) {
            this.logger.error({ msg: 'Failed to create notification', entity: 'Notifications', error: String(error) });
            throw new RepositoryError('Failed to create notification', error);
        }
    }

    async findById(id: string): Promise<Notification | null> {
        try {
            return await this.repository.findOne({ where: { id } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to find notification by ID', entity: 'Notifications', error: String(error) });
            throw new RepositoryError('Failed to find notification', error);
        }
    }

    async findAll(filters: NotificationFilters, pagination: PaginationOptions): Promise<PaginatedResult<Notification>> {
        try {
            const where: Record<string, unknown> = {};

            if (filters.status && filters.status.length > 0) {
                where.status = In(filters.status);
            }
            if (filters.severity) {
                where.severity = filters.severity;
            }
            if (filters.source) {
                where.source = filters.source;
            }
            if (filters.type) {
                where.type = filters.type;
            }
            if (filters.fromDate) {
                where.createdAt = MoreThanOrEqual(filters.fromDate);
            }
            if (filters.toDate) {
                where.createdAt = where.createdAt ? undefined : LessThanOrEqual(filters.toDate);
            }

            const skip = (pagination.page - 1) * pagination.pageSize;

            // Handle date range with raw query builder if both dates provided
            const qb = this.repository.createQueryBuilder('notification');

            if (filters.status && filters.status.length > 0) {
                qb.andWhere('notification.status IN (:...statuses)', { statuses: filters.status });
            }
            if (filters.severity) {
                qb.andWhere('notification.severity = :severity', { severity: filters.severity });
            }
            if (filters.source) {
                qb.andWhere('notification.source = :source', { source: filters.source });
            }
            if (filters.type) {
                qb.andWhere('notification.type = :type', { type: filters.type });
            }
            if (filters.fromDate) {
                qb.andWhere('notification."createdAt" >= :fromDate', { fromDate: filters.fromDate });
            }
            if (filters.toDate) {
                qb.andWhere('notification."createdAt" <= :toDate', { toDate: filters.toDate });
            }

            qb.orderBy('notification."createdAt"', 'DESC');
            qb.skip(skip).take(pagination.pageSize);

            const [data, total] = await qb.getManyAndCount();

            return { data, total };
        } catch (error) {
            this.logger.error({ msg: 'Failed to list notifications', entity: 'Notifications', error: String(error) });
            throw new RepositoryError('Failed to list notifications', error);
        }
    }

    async update(notification: Notification): Promise<Notification> {
        try {
            return await this.repository.save(notification);
        } catch (error) {
            this.logger.error({ msg: 'Failed to update notification', entity: 'Notifications', error: String(error) });
            throw new RepositoryError('Failed to update notification', error);
        }
    }

    async updateMany(ids: string[], partial: Partial<Notification>): Promise<number> {
        try {
            const result = await this.repository.update({ id: In(ids) }, partial as any);
            return result.affected ?? 0;
        } catch (error) {
            this.logger.error({ msg: 'Failed to bulk update notifications', entity: 'Notifications', error: String(error) });
            throw new RepositoryError('Failed to bulk update notifications', error);
        }
    }

    async findByIds(ids: string[]): Promise<Notification[]> {
        try {
            return await this.repository.find({ where: { id: In(ids) } });
        } catch (error) {
            this.logger.error({ msg: 'Failed to find notifications by IDs', entity: 'Notifications', error: String(error) });
            throw new RepositoryError('Failed to find notifications by IDs', error);
        }
    }
}
