export interface ConditionConfig {
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';
    value: number;
    field?: string;
}

export interface NotificationConfig {
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    message: string;
}

export interface AlertRule {
    _id: string;
    name: string;
    description: string;
    enabled: boolean;
    dataSource: string;
    query: string;
    condition: ConditionConfig;
    intervalMinutes: number;
    notification: NotificationConfig;
    cooldownMinutes: number;
    emails: string[];
    lastCheckedAt: string | null;
    lastResult: number | null;
    lastTriggeredAt: string | null;
    consecutiveFailures: number;
    lastError: string | null;
    templateId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AlertExecution {
    _id: string;
    ruleId: string;
    ruleName: string;
    executedAt: string;
    queryResult: number | null;
    conditionMet: boolean;
    notificationDispatched: boolean;
    skippedReason: string | null;
    error: string | null;
    durationMs: number | null;
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
    dataSource: string;
    query: string;
    condition: ConditionConfig;
    intervalMinutes: number;
    notification: NotificationConfig;
    cooldownMinutes: number;
    variables: TemplateVariable[];
}

export interface DataSourceInfo {
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
}

export interface TestQueryResult {
    result: number;
    durationMs: number;
}

export interface TestRuleResult {
    queryResult: number;
    conditionMet: boolean;
    durationMs: number;
    wouldNotify: boolean;
    cooldownActive: boolean;
}

export type CreateAlertRuleData = Omit<AlertRule, '_id' | 'lastCheckedAt' | 'lastResult' | 'lastTriggeredAt' | 'consecutiveFailures' | 'lastError' | 'templateId' | 'createdAt' | 'updatedAt'>;
