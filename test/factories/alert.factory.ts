let counter = 0;

export function buildCreateAlertRuleDto(overrides: Record<string, unknown> = {}) {
    counter++;
    return {
        name: `Test Alert Rule ${counter}`,
        description: `Test description ${counter}`,
        enabled: true,
        dataSource: 'mongodb_local',
        query: '{"collection":"logs","filter":{"level":"error"}}',
        condition: { operator: 'eq', value: 0, field: 'count' },
        intervalMinutes: 10,
        notification: {
            severity: 'WARNING',
            title: `Alert Title ${counter}`,
            message: `Alert Message ${counter}`,
        },
        cooldownMinutes: 30,
        ...overrides,
    };
}

export function resetFactory(): void {
    counter = 0;
}
