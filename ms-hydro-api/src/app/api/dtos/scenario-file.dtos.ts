import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// ScenarioFile metadata (no content)
// ─────────────────────────────────────────────────────────────

export class ScenarioFileMetadataResponseDto {
    @ApiProperty({ description: 'File ID', example: '660e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Owning scenario ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    scenarioId: string;

    @ApiProperty({ description: 'Original file name', example: 'episodio-1.csv' })
    filename: string;

    @ApiProperty({ description: 'MIME content type', example: 'text/csv' })
    contentType: string;

    @ApiProperty({ description: 'File size in bytes', example: 20481 })
    sizeBytes: number;

    @ApiProperty({ description: 'Creation timestamp', example: '2026-08-12T00:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ description: 'Last update timestamp', example: '2026-08-12T00:00:00.000Z' })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// AddFilesToScenario (multipart upload response)
// ─────────────────────────────────────────────────────────────

export class AddFilesToScenarioResponseDto {
    @ApiProperty({ description: 'Scenario the files were added to', example: '550e8400-e29b-41d4-a716-446655440000' })
    scenarioId: string;

    @ApiProperty({ description: 'Files created', type: [ScenarioFileMetadataResponseDto] })
    files: ScenarioFileMetadataResponseDto[];
}

// ─────────────────────────────────────────────────────────────
// DeleteScenarioFile
// ─────────────────────────────────────────────────────────────

export class DeleteScenarioFileResponseDto {
    @ApiProperty({ description: 'Deleted file ID', example: '660e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Whether the file was deleted', example: true })
    deleted: boolean;
}
