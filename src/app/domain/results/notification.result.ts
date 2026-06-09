import { NotificationSeverity } from '@domain/types/notification-severity.enum';
import { NotificationStatus } from '@domain/types/notification-status.enum';

// ─────────────────────────────────────────────────────────────
// NotificationResult
// ─────────────────────────────────────────────────────────────

export interface INotificationResult {
    id: string;
    type: string;
    source: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
    severity: NotificationSeverity;
    status: NotificationStatus;
    createdAt: Date;
    updatedAt: Date;
}

export class NotificationResult {
    readonly id: string;
    readonly type: string;
    readonly source: string;
    readonly title: string;
    readonly message: string;
    readonly metadata: Record<string, unknown>;
    readonly severity: NotificationSeverity;
    readonly status: NotificationStatus;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: INotificationResult) {
        this.id = params.id;
        this.type = params.type;
        this.source = params.source;
        this.title = params.title;
        this.message = params.message;
        this.metadata = params.metadata;
        this.severity = params.severity;
        this.status = params.status;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// ListNotificationsResult
// ─────────────────────────────────────────────────────────────

export class ListNotificationsResult {
    readonly data: NotificationResult[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;

    constructor(params: { data: NotificationResult[]; total: number; page: number; pageSize: number }) {
        this.data = params.data;
        this.total = params.total;
        this.page = params.page;
        this.pageSize = params.pageSize;
        this.totalPages = Math.ceil(params.total / params.pageSize);
    }
}

// ─────────────────────────────────────────────────────────────
// BulkUpdateResult
// ─────────────────────────────────────────────────────────────

export class BulkUpdateResult {
    readonly updated: string[];
    readonly notFound: string[];

    constructor(params: { updated: string[]; notFound: string[] }) {
        this.updated = params.updated;
        this.notFound = params.notFound;
    }
}
