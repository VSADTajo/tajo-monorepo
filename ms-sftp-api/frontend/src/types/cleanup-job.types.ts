export type CleanupFrequency =
    | 'EVERY_5_MIN'
    | 'EVERY_15_MIN'
    | 'EVERY_30_MIN'
    | 'EVERY_HOUR'
    | 'EVERY_6_HOURS'
    | 'EVERY_12_HOURS'
    | 'EVERY_DAY'
    | 'EVERY_WEEK';

export interface CleanupJobInfo {
    id: string;
    extensions: string[];
    frequency: CleanupFrequency;
    frequencyLabel: string;
    isActive: boolean;
    nextExecutionAt: string | null;
    lastExecutedAt: string | null;
    lastExecutionResult: { filesDeleted: number; error?: string } | null;
}

export interface CleanupJob {
    id: string;
    directoryPath: string;
    extensions: string[];
    frequency: CleanupFrequency;
    frequencyLabel: string;
    isActive: boolean;
    lastExecutedAt: string | null;
    lastExecutionResult: { filesDeleted: number; error?: string } | null;
    nextExecutionAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCleanupJobRequest {
    directoryPath: string;
    extensions: string[];
    frequency: CleanupFrequency;
}

export interface UpdateCleanupJobRequest {
    extensions?: string[];
    frequency?: CleanupFrequency;
}

export interface ToggleCleanupJobRequest {
    isActive: boolean;
}
