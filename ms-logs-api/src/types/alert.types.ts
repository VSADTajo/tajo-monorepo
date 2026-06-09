export enum DataSource {
    MONGODB_LOCAL = 'mongodb_local',
    PG_PREDICTIONS = 'pg_predictions',
    PG_HYDRO = 'pg_hydro',
    PG_MODEL = 'pg_model',
    PG_NOTIFICATIONS = 'pg_notifications',
    PG_METEO = 'pg_meteo',
    PG_USER = 'pg_user',
    PG_SFTP = 'pg_sftp',
}

export enum ConditionOperator {
    EQ = 'eq',
    NEQ = 'neq',
    GT = 'gt',
    LT = 'lt',
    GTE = 'gte',
    LTE = 'lte',
}

export enum NotificationSeverity {
    INFO = 'INFO',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL',
}

export interface ConditionConfig {
    operator: ConditionOperator;
    value: number;
    field?: string;
}

export interface NotificationConfig {
    severity: NotificationSeverity;
    title: string;
    message: string;
}

export interface AlertRuleData {
    name: string;
    description?: string;
    enabled: boolean;
    dataSource: DataSource;
    query: string;
    condition: ConditionConfig;
    intervalMinutes: number;
    notification: NotificationConfig;
    cooldownMinutes: number;
    emails: string[];
    lastCheckedAt?: Date | null;
    lastResult?: number | null;
    lastTriggeredAt?: Date | null;
    consecutiveFailures?: number;
    lastError?: string | null;
    templateId?: string | null;
}

export interface AlertExecutionData {
    ruleId: string;
    ruleName: string;
    executedAt: Date;
    queryResult: number | null;
    conditionMet: boolean;
    notificationDispatched: boolean;
    skippedReason?: string | null;
    error?: string | null;
    durationMs?: number | null;
}

export interface TemplateVariable {
    name: string;
    label: string;
    type: 'number' | 'string';
    default: string | number;
}

export interface AlertTemplate {
    id: string;
    name: string;
    description: string;
    dataSource: DataSource;
    query: string;
    condition: ConditionConfig;
    intervalMinutes: number;
    notification: NotificationConfig;
    cooldownMinutes: number;
    variables: TemplateVariable[];
}
