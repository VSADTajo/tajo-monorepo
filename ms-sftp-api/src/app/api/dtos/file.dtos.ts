import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// UploadFile
// ─────────────────────────────────────────────────────────────

export class UploadFileResponseDto {
    @ApiProperty({ description: 'Relative path where the file was stored', example: 'inbox/partner-a/report.csv' })
    path: string;

    @ApiProperty({ description: 'File size in bytes', example: 2097152 })
    size: number;
}

// ─────────────────────────────────────────────────────────────
// ListFiles
// ─────────────────────────────────────────────────────────────

export class FileInfoDto {
    @ApiProperty({ description: 'File name', example: 'report-2026-03.csv' })
    name: string;

    @ApiProperty({ description: 'Relative path to storage base', example: 'inbox/partner-a/report-2026-03.csv' })
    path: string;

    @ApiProperty({ description: 'Size in bytes', example: 1048576 })
    size: number;

    @ApiProperty({ description: 'Last modification date', example: '2026-03-04T10:30:00Z' })
    modifiedAt: string;

    @ApiProperty({ description: 'True if this is a directory', example: false })
    isDirectory: boolean;
}

export class ListFilesResponseDto {
    @ApiProperty({ description: 'Directory path', example: 'inbox/partner-a' })
    directory: string;

    @ApiProperty({ description: 'List of files', type: [FileInfoDto] })
    files: FileInfoDto[];
}

// ─────────────────────────────────────────────────────────────
// ListPathsOverview
// ─────────────────────────────────────────────────────────────

export class PathSchemaInfoDto {
    @ApiProperty({ description: 'Schema UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Schema name', example: 'Forecast XML Parser' })
    name: string;

    @ApiProperty({ description: 'Whether the schema is active', example: true })
    isActive: boolean;

    @ApiProperty({ description: 'Input format', example: 'xml', enum: ['xml', 'csv'] })
    inputFormat: string;

    @ApiProperty({ description: 'Output format', example: 'json', enum: ['json', 'csv', 'dat', 'parquet'] })
    outputFormat: string;
}

export class PathCleanupJobInfoDto {
    @ApiProperty({ description: 'Cleanup job UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Extensions to delete', example: ['.xml', '.csv'] })
    extensions: string[];

    @ApiProperty({ description: 'Cleanup frequency enum value', example: 'EVERY_DAY' })
    frequency: string;

    @ApiProperty({ description: 'Human-readable frequency label', example: 'Every day' })
    frequencyLabel: string;

    @ApiProperty({ description: 'Whether the job is active', example: true })
    isActive: boolean;

    @ApiProperty({ description: 'Next scheduled execution time', nullable: true, example: '2026-03-10T00:00:00Z' })
    nextExecutionAt: string | null;

    @ApiProperty({ description: 'Last execution timestamp', nullable: true, example: '2026-03-09T00:00:00Z' })
    lastExecutedAt: string | null;

    @ApiProperty({ description: 'Last execution result', nullable: true, example: { filesDeleted: 3 } })
    lastExecutionResult: { filesDeleted: number; error?: string } | null;
}

export class PathOverviewDto {
    @ApiProperty({ description: 'Relative path for use with the file listing endpoint', example: 'forecast' })
    path: string;

    @ApiProperty({ description: 'Original path as stored (for display)', example: '/data/files/forecast' })
    displayPath: string;

    @ApiProperty({ description: 'False if path is outside the storage base directory', example: true })
    canListFiles: boolean;

    @ApiProperty({ description: 'Assigned parsing schema, or null if none', type: PathSchemaInfoDto, nullable: true })
    schema: PathSchemaInfoDto | null;

    @ApiProperty({ description: 'Scheduled cleanup job, or null if none', type: PathCleanupJobInfoDto, nullable: true })
    cleanupJob: PathCleanupJobInfoDto | null;
}

export class ListPathsOverviewResponseDto {
    @ApiProperty({ description: 'List of paths with schema info', type: [PathOverviewDto] })
    paths: PathOverviewDto[];
}

// ─────────────────────────────────────────────────────────────
// ReadFileText
// ─────────────────────────────────────────────────────────────

export class ReadFileTextResponseDto {
    @ApiProperty({ description: 'Relative path to storage base', example: 'tajo/METEO/RADAR/info.json' })
    path: string;

    @ApiProperty({ description: 'Size in bytes', example: 312 })
    size: number;

    @ApiProperty({ description: 'Last modification date', example: '2026-04-06T18:02:00Z' })
    modifiedAt: string;

    @ApiProperty({ description: 'Raw text content of the file (UTF-8)', example: '{"nombre":"Precipitación", ...}' })
    content: string;
}

// ─────────────────────────────────────────────────────────────
// MoveFile
// ─────────────────────────────────────────────────────────────

export class MoveFileRequestDto {
    @ApiProperty({ description: 'Source file path', example: 'inbox/partner-a/report.csv' })
    @IsNotEmpty()
    @IsString()
    sourcePath: string;

    @ApiProperty({ description: 'Destination file path', example: 'processed/partner-a/report.csv' })
    @IsNotEmpty()
    @IsString()
    destinationPath: string;

    @ApiPropertyOptional({ description: 'Allow overwrite if destination exists', default: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    overwrite?: boolean;
}

export class MoveFileResponseDto {
    @ApiProperty({ description: 'Source path', example: 'inbox/partner-a/report.csv' })
    sourcePath: string;

    @ApiProperty({ description: 'Destination path', example: 'processed/partner-a/report.csv' })
    destinationPath: string;
}

// ─────────────────────────────────────────────────────────────
// DeleteFile
// ─────────────────────────────────────────────────────────────

export class DeleteFileResponseDto {
    @ApiProperty({ description: 'Deleted file path', example: 'processed/old-report.csv' })
    deletedPath: string;
}

// ─────────────────────────────────────────────────────────────
// CreateFolder
// ─────────────────────────────────────────────────────────────

export class CreateFolderRequestDto {
    @ApiProperty({
        description: 'Folder path to create (recursive, idempotent — no error if it already exists)',
        example: 'tajo/SIMULATIONS/7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c/output',
    })
    @IsNotEmpty()
    @IsString()
    path: string;
}

export class CreateFolderResponseDto {
    @ApiProperty({
        description: 'Created folder path',
        example: 'tajo/SIMULATIONS/7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c/output',
    })
    path: string;
}
