import { ICleanupExecutionResult } from '@domain/entities/cleanup-job.entity';
import { FREQUENCY_LABEL_MAP } from '@domain/types/cleanup-frequency.enum';

// ─────────────────────────────────────────────────────────────
// CleanupJobResult
// ─────────────────────────────────────────────────────────────

export class CleanupJobResult {
    readonly id: string;
    readonly directoryPath: string;
    readonly extensions: string[];
    readonly frequency: string;
    readonly frequencyLabel: string;
    readonly isActive: boolean;
    readonly lastExecutedAt: Date | null;
    readonly lastExecutionResult: ICleanupExecutionResult | null;
    readonly nextExecutionAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        directoryPath: string;
        extensions: string[];
        frequency: string;
        isActive: boolean;
        lastExecutedAt: Date | null;
        lastExecutionResult: ICleanupExecutionResult | null;
        nextExecutionAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.directoryPath = params.directoryPath;
        this.extensions = params.extensions;
        this.frequency = params.frequency;
        this.frequencyLabel =
            FREQUENCY_LABEL_MAP[params.frequency as keyof typeof FREQUENCY_LABEL_MAP] ?? params.frequency;
        this.isActive = params.isActive;
        this.lastExecutedAt = params.lastExecutedAt;
        this.lastExecutionResult = params.lastExecutionResult;
        this.nextExecutionAt = params.nextExecutionAt;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteCleanupJobResult
// ─────────────────────────────────────────────────────────────

export class DeleteCleanupJobResult {
    readonly deletedId: string;

    constructor(params: { deletedId: string }) {
        this.deletedId = params.deletedId;
    }
}
