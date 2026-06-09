import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CleanupFrequency } from '@domain/types/cleanup-frequency.enum';

// ─────────────────────────────────────────────────────────────
// CreateCleanupJob
// ─────────────────────────────────────────────────────────────

export class CreateCleanupJobRequestDto {
    @ApiProperty({ description: 'Absolute directory path to clean', example: '/data/files/forecast' })
    @IsNotEmpty()
    @IsString()
    directoryPath: string;

    @ApiProperty({
        description: 'File extensions to delete (normalized to lowercase with dot)',
        example: ['.xml', '.csv'],
    })
    @IsArray()
    @IsString({ each: true })
    extensions: string[];

    @ApiProperty({
        description: 'Cleanup frequency',
        enum: CleanupFrequency,
        example: CleanupFrequency.EVERY_DAY,
    })
    @IsEnum(CleanupFrequency)
    frequency: CleanupFrequency;
}

// ─────────────────────────────────────────────────────────────
// UpdateCleanupJob
// ─────────────────────────────────────────────────────────────

export class UpdateCleanupJobRequestDto {
    @ApiPropertyOptional({ description: 'New file extensions to delete', example: ['.xml', '.csv', '.dat'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    extensions?: string[];

    @ApiPropertyOptional({
        description: 'New cleanup frequency',
        enum: CleanupFrequency,
        example: CleanupFrequency.EVERY_HOUR,
    })
    @IsOptional()
    @IsEnum(CleanupFrequency)
    frequency?: CleanupFrequency;
}

// ─────────────────────────────────────────────────────────────
// ToggleCleanupJob
// ─────────────────────────────────────────────────────────────

export class ToggleCleanupJobRequestDto {
    @ApiProperty({ description: 'Whether to activate or deactivate the job', example: false })
    @IsBoolean()
    isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
// Response
// ─────────────────────────────────────────────────────────────

export class CleanupJobExecutionResultDto {
    @ApiProperty({ description: 'Number of files deleted', example: 3 })
    filesDeleted: number;

    @ApiPropertyOptional({ description: 'Error message if execution failed', example: null, nullable: true })
    error?: string;
}

export class CleanupJobResponseDto {
    @ApiProperty({ description: 'Cleanup job UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Absolute directory path', example: '/data/files/forecast' })
    directoryPath: string;

    @ApiProperty({ description: 'File extensions to delete', example: ['.xml', '.csv'] })
    extensions: string[];

    @ApiProperty({ description: 'Cleanup frequency enum value', example: 'EVERY_DAY' })
    frequency: string;

    @ApiProperty({ description: 'Human-readable frequency label', example: 'Every day' })
    frequencyLabel: string;

    @ApiProperty({ description: 'Whether the job is active', example: true })
    isActive: boolean;

    @ApiProperty({ description: 'Last execution time', nullable: true, example: null })
    lastExecutedAt: string | null;

    @ApiProperty({ description: 'Last execution result', nullable: true, type: CleanupJobExecutionResultDto })
    lastExecutionResult: CleanupJobExecutionResultDto | null;

    @ApiProperty({ description: 'Next scheduled execution time', nullable: true, example: '2026-03-10T00:00:00Z' })
    nextExecutionAt: string | null;

    @ApiProperty({ description: 'Creation timestamp', example: '2026-03-09T12:00:00Z' })
    createdAt: string;

    @ApiProperty({ description: 'Last update timestamp', example: '2026-03-09T12:00:00Z' })
    updatedAt: string;
}

export class CleanupJobOrNullResponseDto {
    @ApiProperty({ description: 'Cleanup job or null', type: CleanupJobResponseDto, nullable: true })
    job: CleanupJobResponseDto | null;
}

export class DeleteCleanupJobResponseDto {
    @ApiProperty({ description: 'Deleted cleanup job UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
    deletedId: string;
}
