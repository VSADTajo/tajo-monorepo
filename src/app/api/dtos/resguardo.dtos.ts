import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// GetResguardosByStation (query params)
// ─────────────────────────────────────────────────────────────

export class GetResguardosByStationRequestDto {
    @ApiProperty({ description: 'Filter by year', example: 2025, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    year?: number;

    @ApiProperty({ description: 'Filter from date (YYYY-MM-DD)', example: '2025-01-01', required: false })
    @IsOptional()
    @IsString()
    from?: string;

    @ApiProperty({ description: 'Filter to date (YYYY-MM-DD)', example: '2025-12-31', required: false })
    @IsOptional()
    @IsString()
    to?: string;
}

// ─────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────

export class ResolvedResguardoEntryDto {
    @ApiProperty({ description: 'Minimum volume (Hm3)', example: 51.15, nullable: true })
    minimumVolume: number | null;

    @ApiProperty({ description: 'Reserve volume (Hm3)', example: 802.563, nullable: true })
    reserveVolume: number | null;

    @ApiProperty({ description: 'Reserve level (m)', example: 718, nullable: true })
    reserveLevel: number | null;
}

export class GetResguardosByStationResponseDto {
    @ApiProperty({ description: 'Station code', example: 'E_01' })
    stationCode: string;

    @ApiProperty({ description: 'Station name', example: 'ENTREPEÑAS' })
    stationName: string;

    @ApiProperty({
        description: 'Map of date (YYYY-MM-DD) to resolved resguardo values',
        example: {
            '2025-10-01': { minimumVolume: 51.15, reserveVolume: 802.563, reserveLevel: 718 },
            '2025-10-02': { minimumVolume: 45.0, reserveVolume: 750.0, reserveLevel: 710 },
        },
    })
    entries: Record<string, ResolvedResguardoEntryDto>;

    @ApiProperty({ description: 'Total entries', example: 365 })
    total: number;
}

export class GetResguardoByDateResponseDto {
    @ApiProperty({ description: 'Station code', example: 'E_01' })
    stationCode: string;

    @ApiProperty({ description: 'Station name', example: 'ENTREPEÑAS' })
    stationName: string;

    @ApiProperty({ description: 'Resolved resguardo values', type: ResolvedResguardoEntryDto })
    entry: ResolvedResguardoEntryDto;
}

// ─────────────────────────────────────────────────────────────
// UpdateResguardo
// ─────────────────────────────────────────────────────────────

export class UpdateResguardoRequestDto {
    @ApiProperty({ description: 'Reserve volume (Hm3)', example: 750.0, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    reserveVolume?: number | null;

    @ApiProperty({ description: 'Reserve level (m)', example: 710.0, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    reserveLevel?: number | null;

    @ApiProperty({ description: 'Minimum volume (Hm3)', example: 45.0, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    minimumVolume?: number | null;
}

export class UpdateResguardoResponseDto {
    @ApiProperty({ description: 'Updated resolved entry', type: ResolvedResguardoEntryDto })
    entry: ResolvedResguardoEntryDto;
}

// ─────────────────────────────────────────────────────────────
// ImportResguardos
// ─────────────────────────────────────────────────────────────

export class ImportResguardosResponseDto {
    @ApiProperty({ description: 'Total rows imported', example: 34310 })
    totalImported: number;

    @ApiProperty({ description: 'Number of stations processed', example: 47 })
    stationsProcessed: number;
}
