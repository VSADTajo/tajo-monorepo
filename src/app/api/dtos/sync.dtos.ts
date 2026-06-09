import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// SyncGeoserver
// ─────────────────────────────────────────────────────────────

export class SyncGeoserverResponseDto {
    @ApiProperty({ description: 'Number of basins created', example: 11 })
    basinsCreated: number;

    @ApiProperty({ description: 'Number of basins updated', example: 0 })
    basinsUpdated: number;

    @ApiProperty({ description: 'Number of sub-basins created', example: 119 })
    subBasinsCreated: number;

    @ApiProperty({ description: 'Number of sub-basins updated', example: 0 })
    subBasinsUpdated: number;

    @ApiProperty({ description: 'Number of stations created', example: 254 })
    stationsCreated: number;

    @ApiProperty({ description: 'Number of stations updated', example: 0 })
    stationsUpdated: number;

    @ApiProperty({ description: 'Number of thresholds created', example: 143 })
    thresholdsCreated: number;

    @ApiProperty({ description: 'Number of thresholds updated', example: 0 })
    thresholdsUpdated: number;

    @ApiProperty({ description: 'Errors encountered during sync', type: [String], example: [] })
    errors: string[];
}
