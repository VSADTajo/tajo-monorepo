export enum IngestStatus {
    RUNNING = 'running',
    OK = 'ok',
    PARTIAL = 'partial',
    FAILED = 'failed',
    NOOP = 'noop',
}

export enum TriggerSource {
    CRON = 'cron',
    MANUAL = 'manual',
}
