import { Inject, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { INotificationRepository } from '@domain/ports/notification-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { Notification } from '@domain/entities/notification.entity';
import { NotificationResult, BulkUpdateResult } from '@domain/results/notification.result';
import { NotificationSeverity } from '@domain/types/notification-severity.enum';
import { NotificationStatus } from '@domain/types/notification-status.enum';
import { ApiError } from '@domain/errors/api.error';

// Cache
import { NotificationCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateNotification
// ─────────────────────────────────────────────────────────────

export interface ICreateNotificationCommand {
    type: string;
    source: string;
    title: string;
    message: string;
    severity: NotificationSeverity;
    metadata?: Record<string, unknown>;
}

export class CreateNotificationCommand {
    constructor(private readonly parameters: ICreateNotificationCommand) {}

    get type(): string {
        return this.parameters.type;
    }

    get source(): string {
        return this.parameters.source;
    }

    get title(): string {
        return this.parameters.title;
    }

    get message(): string {
        return this.parameters.message;
    }

    get severity(): NotificationSeverity {
        return this.parameters.severity;
    }

    get metadata(): Record<string, unknown> {
        return this.parameters.metadata ?? {};
    }
}

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<CreateNotificationCommand, NotificationResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly notificationRepository: INotificationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateNotificationCommand): Promise<NotificationResult> {
        this.logger.log(`Creating notification: type=${command.type}, source=${command.source}`);

        const notification = new Notification({
            type: command.type,
            source: command.source,
            title: command.title,
            message: command.message,
            severity: command.severity,
            metadata: command.metadata,
            status: NotificationStatus.UNREAD,
        });
        notification.validate();

        const persisted = await this.notificationRepository.create(notification);

        await this.cacheService.delByPattern(NotificationCacheKeys.pattern());

        return new NotificationResult(persisted);
    }
}

// ─────────────────────────────────────────────────────────────
// MarkAsRead
// ─────────────────────────────────────────────────────────────

export interface IMarkAsReadCommand {
    id: string;
}

export class MarkAsReadCommand {
    constructor(private readonly parameters: IMarkAsReadCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(MarkAsReadCommand)
export class MarkAsReadHandler implements ICommandHandler<MarkAsReadCommand, NotificationResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly notificationRepository: INotificationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: MarkAsReadCommand): Promise<NotificationResult> {
        this.logger.log({ msg: 'Notification marked as read', entity: 'Notifications', id: command.id });

        const notification = await this.notificationRepository.findById(command.id);
        if (!notification) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Notification not found: ${command.id}`);
        }

        if (notification.status !== NotificationStatus.READ) {
            notification.status = NotificationStatus.READ;
            const updated = await this.notificationRepository.update(notification);
            await this.cacheService.delByPattern(NotificationCacheKeys.pattern());
            return new NotificationResult(updated);
        }

        return new NotificationResult(notification);
    }
}

// ─────────────────────────────────────────────────────────────
// ArchiveNotification
// ─────────────────────────────────────────────────────────────

export interface IArchiveNotificationCommand {
    id: string;
}

export class ArchiveNotificationCommand {
    constructor(private readonly parameters: IArchiveNotificationCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(ArchiveNotificationCommand)
export class ArchiveNotificationHandler implements ICommandHandler<ArchiveNotificationCommand, NotificationResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly notificationRepository: INotificationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ArchiveNotificationCommand): Promise<NotificationResult> {
        this.logger.log({ msg: 'Notification archived', entity: 'Notifications', id: command.id });

        const notification = await this.notificationRepository.findById(command.id);
        if (!notification) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Notification not found: ${command.id}`);
        }

        if (notification.status === NotificationStatus.ARCHIVED) {
            throw new ApiError(HttpStatus.BAD_REQUEST, `Notification is already archived: ${command.id}`);
        }

        notification.status = NotificationStatus.ARCHIVED;
        const updated = await this.notificationRepository.update(notification);

        await this.cacheService.delByPattern(NotificationCacheKeys.pattern());

        return new NotificationResult(updated);
    }
}

// ─────────────────────────────────────────────────────────────
// BulkMarkAsRead
// ─────────────────────────────────────────────────────────────

export interface IBulkMarkAsReadCommand {
    ids: string[];
}

export class BulkMarkAsReadCommand {
    constructor(private readonly parameters: IBulkMarkAsReadCommand) {}

    get ids(): string[] {
        return this.parameters.ids;
    }
}

@CommandHandler(BulkMarkAsReadCommand)
export class BulkMarkAsReadHandler implements ICommandHandler<BulkMarkAsReadCommand, BulkUpdateResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly notificationRepository: INotificationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: BulkMarkAsReadCommand): Promise<BulkUpdateResult> {
        this.logger.log({ msg: 'Bulk marked as read', entity: 'Notifications', count: command.ids.length });

        const existing = await this.notificationRepository.findByIds(command.ids);
        const existingIds = existing.map((n) => n.id);
        const notFound = command.ids.filter((id) => !existingIds.includes(id));

        if (existingIds.length > 0) {
            await this.notificationRepository.updateMany(existingIds, {
                status: NotificationStatus.READ,
            } as Partial<Notification>);
            await this.cacheService.delByPattern(NotificationCacheKeys.pattern());
        }

        return new BulkUpdateResult({ updated: existingIds, notFound });
    }
}

// ─────────────────────────────────────────────────────────────
// BulkArchive
// ─────────────────────────────────────────────────────────────

export interface IBulkArchiveCommand {
    ids: string[];
}

export class BulkArchiveCommand {
    constructor(private readonly parameters: IBulkArchiveCommand) {}

    get ids(): string[] {
        return this.parameters.ids;
    }
}

@CommandHandler(BulkArchiveCommand)
export class BulkArchiveHandler implements ICommandHandler<BulkArchiveCommand, BulkUpdateResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly notificationRepository: INotificationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: BulkArchiveCommand): Promise<BulkUpdateResult> {
        this.logger.log({ msg: 'Bulk archived', entity: 'Notifications', count: command.ids.length });

        const existing = await this.notificationRepository.findByIds(command.ids);
        const existingIds = existing.map((n) => n.id);
        const notFound = command.ids.filter((id) => !existingIds.includes(id));

        if (existingIds.length > 0) {
            await this.notificationRepository.updateMany(existingIds, {
                status: NotificationStatus.ARCHIVED,
            } as Partial<Notification>);
            await this.cacheService.delByPattern(NotificationCacheKeys.pattern());
        }

        return new BulkUpdateResult({ updated: existingIds, notFound });
    }
}
