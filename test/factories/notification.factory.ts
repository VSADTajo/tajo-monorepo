let counter = 0;

export function buildCreateNotificationDto(
    overrides?: Partial<{
        type: string;
        source: string;
        title: string;
        message: string;
        severity: string;
        metadata: Record<string, unknown>;
    }>,
): {
    type: string;
    source: string;
    title: string;
    message: string;
    severity: string;
    metadata: Record<string, unknown>;
} {
    counter++;
    return {
        type: 'TEST_EVENT',
        source: 'ms-test',
        title: `Test notification ${counter}`,
        message: `Test message ${counter}`,
        severity: 'INFO',
        metadata: {},
        ...overrides,
    };
}
