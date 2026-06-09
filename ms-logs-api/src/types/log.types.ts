export enum LogLevel {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
}

export interface LogData {
    level: LogLevel;
    entity: string;
    message: string;
    source?: string | undefined;
    meta?: Record<string, any> | undefined;
    filePath?: string | null;
    correlationId?: string | null;
}