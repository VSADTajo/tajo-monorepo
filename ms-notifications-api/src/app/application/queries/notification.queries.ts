import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import {
    INotificationRepository,
    NotificationFilters,
    PaginationOptions,
} from '@domain/ports/notification-repository.port';
import { NotificationResult, ListNotificationsResult } from '@domain/results/notification.result';
import { NotificationSeverity } from '@domain/types/notification-severity.enum';
import { NotificationStatus } from '@domain/types/notification-status.enum';

// ─────────────────────────────────────────────────────────────
// ListNotifications
// ─────────────────────────────────────────────────────────────

export interface IListNotificationsQuery {
    page: number;
    pageSize: number;
    status?: NotificationStatus[];
    severity?: NotificationSeverity;
    source?: string;
    type?: string;
    fromDate?: Date;
    toDate?: Date;
}

export class ListNotificationsQuery {
    constructor(private readonly parameters: IListNotificationsQuery) {}

    get page(): number {
        return this.parameters.page;
    }

    get pageSize(): number {
        return this.parameters.pageSize;
    }

    get status(): NotificationStatus[] | undefined {
        return this.parameters.status;
    }

    get severity(): NotificationSeverity | undefined {
        return this.parameters.severity;
    }

    get source(): string | undefined {
        return this.parameters.source;
    }

    get type(): string | undefined {
        return this.parameters.type;
    }

    get fromDate(): Date | undefined {
        return this.parameters.fromDate;
    }

    get toDate(): Date | undefined {
        return this.parameters.toDate;
    }
}

@QueryHandler(ListNotificationsQuery)
export class ListNotificationsHandler implements IQueryHandler<ListNotificationsQuery, ListNotificationsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly notificationRepository: INotificationRepository,
    ) {}

    async execute(query: ListNotificationsQuery): Promise<ListNotificationsResult> {
        this.logger.debug(`Listing notifications: page=${query.page}, pageSize=${query.pageSize}`);

        const filters: NotificationFilters = {
            severity: query.severity,
            source: query.source,
            type: query.type,
            fromDate: query.fromDate,
            toDate: query.toDate,
        };

        // Default: exclude ARCHIVED unless explicitly requested
        if (query.status && query.status.length > 0) {
            filters.status = query.status;
        } else {
            filters.status = [NotificationStatus.UNREAD, NotificationStatus.READ];
        }

        const pagination: PaginationOptions = {
            page: query.page,
            pageSize: query.pageSize,
        };

        const { data, total } = await this.notificationRepository.findAll(filters, pagination);
        const results = data.map((n) => new NotificationResult(n));

        return new ListNotificationsResult({
            data: results,
            total,
            page: query.page,
            pageSize: query.pageSize,
        });
    }
}
