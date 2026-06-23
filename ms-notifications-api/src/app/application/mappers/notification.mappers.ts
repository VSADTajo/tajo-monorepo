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
import { NotificationSeverity } from '@domain/types/notification-severity.enum';

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
// SimulationStatusNotification — maps a simulation.status.updated event
// ─────────────────────────────────────────────────────────────

export const SIMULATION_STATUS_NOTIFICATION_TYPE = 'SIMULATION_STATUS_CHANGED';
export const SIMULATION_STATUS_NOTIFICATION_SOURCE = 'ms-model-api';

interface SimulationStatusPresentation {
    severity: NotificationSeverity;
    title: string;
    message: (simulationId: string) => string;
}

/**
 * Presentation per simulation status. Extensible: today the simulation pipeline
 * only publishes MODEL_FAILED, but new statuses can be added here without
 * touching the consumer. Unknown statuses fall back to a generic INFO notice.
 */
const SIMULATION_STATUS_PRESENTATIONS: Record<string, SimulationStatusPresentation> = {
    MODEL_FAILED: {
        severity: NotificationSeverity.CRITICAL,
        title: 'Simulación fallida',
        message: (id) => `La simulación ${id} falló durante la ejecución del modelo.`,
    },
    FINALIZED: {
        severity: NotificationSeverity.INFO,
        title: 'Simulación finalizada',
        message: (id) => `La simulación ${id} finalizó correctamente.`,
    },
};

export class SimulationStatusNotificationMapper {
    static fromEvent(simulationId: string, status: string): CreateNotificationCommand {
        const preset = SIMULATION_STATUS_PRESENTATIONS[status] ?? {
            severity: NotificationSeverity.INFO,
            title: 'Estado de simulación actualizado',
            message: (id: string) => `La simulación ${id} cambió de estado a ${status}.`,
        };

        return new CreateNotificationCommand({
            type: SIMULATION_STATUS_NOTIFICATION_TYPE,
            source: SIMULATION_STATUS_NOTIFICATION_SOURCE,
            title: preset.title,
            message: preset.message(simulationId),
            severity: preset.severity,
            metadata: { simulationId, status },
        });
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
