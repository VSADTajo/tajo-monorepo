export function buildCreateCleanupJobDto(
    directoryPath: string,
    overrides?: Partial<{ extensions: string[]; frequency: string }>,
) {
    return {
        directoryPath,
        extensions: ['.xml', '.csv'],
        frequency: 'EVERY_DAY',
        ...overrides,
    };
}
