export type AerialPrecipitationConfig = {
    sftpDirectory: string;
    pollIntervalMs: number;
    filePrefixes: string[];
    retentionDays: number;
    cleanupCron: string;
    listCacheTtlSeconds: number;
    latestCacheTtlSeconds: number;
};
