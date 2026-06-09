import {
    CreateNotificationRequestDto,
    ListNotificationsQueryDto,
    NotificationResponseDto,
    ListNotificationsResponseDto,
    UpdateNotificationResponseDto,
    BulkIdsRequestDto,
    BulkUpdateResponseDto,
} from '@api/dtos/notification.dtos';
import {
    CreateNotificationCommand,
    MarkAsReadCommand,
    ArchiveNotificationCommand,
    BulkMarkAsReadCommand,
    BulkArchiveCommand,
} from '@application/commands/notification.commands';
import { ListNotificationsQuery } from '@application/queries/notification.queries';
import { NotificationResult, ListNotificationsResult, BulkUpdateResult } from '@domain/results/notification.result';
import { NotificationStatus } from '@domain/types/notification-status.enum';

// ─────────────────────────────────────────────────────────────
// Shared: Result -> ResponseDto
// ─────────────────────────────────────────────────────────────

function toNotificationResponseDto(result: NotificationResult): NotificationResponseDto {
    return {
        id: result.id,
        type: result.type,
        source: result.source,
        title: result.title,
        message: result.message,
        metadata: result.metadata,
        severity: result.severity,
        status: result.status,
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : String(result.createdAt),
        updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : String(result.updatedAt),
    };
}

// ─────────────────────────────────────────────────────────────
// CreateNotification
// ─────────────────────────────────────────────────────────────

export class CreateNotificationMapper {
    static toCommand(dto: CreateNotificationRequestDto): CreateNotificationCommand {
        return new CreateNotificationCommand({
            type: dto.type,
            source: dto.source,
            title: dto.title,
            message: dto.message,
            severity: dto.severity,
            metadata: dto.metadata,
        });
    }

    static fromPayload(payload: Record<string, unknown>): CreateNotificationCommand {
        return new CreateNotificationCommand({
            type: payload.type as string,
            source: payload.source as string,
            title: payload.title as string,
            message: payload.message as string,
            severity: payload.severity as any,
            metadata: (payload.metadata as Record<string, unknown>) ?? {},
        });
    }

    static toResponseDto(result: NotificationResult): NotificationResponseDto {
        return toNotificationResponseDto(result);
    }
}

// ─────────────────────────────────────────────────────────────
// ListNotifications
// ─────────────────────────────────────────────────────────────

export class ListNotificationsMapper {
    static toQuery(dto: ListNotificationsQueryDto): ListNotificationsQuery {
        let statusArray: NotificationStatus[] | undefined;
        if (dto.status) {
            statusArray = dto.status.split(',').map((s) => s.trim() as NotificationStatus);
        }

        return new ListNotificationsQuery({
            page: dto.page ?? 1,
            pageSize: dto.pageSize ?? 20,
            status: statusArray,
            severity: dto.severity,
            source: dto.source,
            type: dto.type,
            fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
            toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        });
    }

    static toResponseDto(result: ListNotificationsResult): ListNotificationsResponseDto {
        return {
            data: result.data.map(toNotificationResponseDto),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// MarkAsRead
// ─────────────────────────────────────────────────────────────

export class MarkAsReadMapper {
    static toCommand(id: string): MarkAsReadCommand {
        return new MarkAsReadCommand({ id });
    }

    static toResponseDto(result: NotificationResult): UpdateNotificationResponseDto {
        return {
            id: result.id,
            status: result.status,
            updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : String(result.updatedAt),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ArchiveNotification
// ─────────────────────────────────────────────────────────────

export class ArchiveNotificationMapper {
    static toCommand(id: string): ArchiveNotificationCommand {
        return new ArchiveNotificationCommand({ id });
    }

    static toResponseDto(result: NotificationResult): UpdateNotificationResponseDto {
        return {
            id: result.id,
            status: result.status,
            updatedAt: result.updatedAt instanceof Date ? result.updatedAt.toISOString() : String(result.updatedAt),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// BulkOperations
// ─────────────────────────────────────────────────────────────

export class BulkOperationsMapper {
    static toBulkReadCommand(dto: BulkIdsRequestDto): BulkMarkAsReadCommand {
        return new BulkMarkAsReadCommand({ ids: dto.ids });
    }

    static toBulkArchiveCommand(dto: BulkIdsRequestDto): BulkArchiveCommand {
        return new BulkArchiveCommand({ ids: dto.ids });
    }

    static toResponseDto(result: BulkUpdateResult): BulkUpdateResponseDto {
        return {
            updated: result.updated,
            notFound: result.notFound,
        };
    }
}
