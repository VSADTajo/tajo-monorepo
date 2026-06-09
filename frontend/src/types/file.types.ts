import type { CleanupJobInfo } from './cleanup-job.types';

export interface FileInfo {
    name: string;
    path: string;
    size: number;
    modifiedAt: string;
    isDirectory: boolean;
}

export interface ListFilesResponse {
    directory: string;
    files: FileInfo[];
}

export interface PathSchemaInfo {
    id: string;
    name: string;
    isActive: boolean;
    inputFormat: string;
    outputFormat: string;
}

export interface PathOverview {
    path: string;
    displayPath: string;
    canListFiles: boolean;
    schema: PathSchemaInfo | null;
    cleanupJob: CleanupJobInfo | null;
}

export interface ListPathsOverviewResponse {
    paths: PathOverview[];
}
