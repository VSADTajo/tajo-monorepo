import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────
// GetMeteoalertaZoneThresholdsByPoint
// ─────────────────────────────────────────────────────────────

export class GetMeteoalertaZoneThresholdsRequestDto {
    @ApiProperty({ description: 'Latitude (WGS84, EPSG:4326)', example: 40.4811 })
    @IsNotEmpty()
    @Type(() => Number)
    @IsLatitude()
    lat: number;

    @ApiProperty({ description: 'Longitude (WGS84, EPSG:4326)', example: -2.7277 })
    @IsNotEmpty()
    @Type(() => Number)
    @IsLongitude()
    lon: number;
}

export class GetMeteoalertaZoneThresholdsResponseDto {
    @ApiProperty({ description: 'Meteoalerta zone code (cod_z)', example: '681901' })
    zonaCode: string;

    @ApiProperty({ description: 'Meteoalerta zone name (nom_z)', example: 'Serranía de Guadalajara' })
    zonaNombre: string;

    @ApiProperty({ description: 'Province name', example: 'Guadalajara', nullable: true })
    provincia: string | null;

    @ApiProperty({ description: 'Autonomous community name', example: 'Castilla - La Mancha', nullable: true })
    ccaa: string | null;

    @ApiProperty({ description: 'Precipitation threshold level 1 accumulated in 1h (mm)', example: 15, nullable: true })
    umbral1Precip1h: number | null;

    @ApiProperty({ description: 'Precipitation threshold level 2 accumulated in 1h (mm)', example: 30, nullable: true })
    umbral2Precip1h: number | null;

    @ApiProperty({ description: 'Precipitation threshold level 3 accumulated in 1h (mm)', example: 60, nullable: true })
    umbral3Precip1h: number | null;

    @ApiProperty({
        description: 'Precipitation threshold level 1 accumulated in 12h (mm)',
        example: 40,
        nullable: true,
    })
    umbral1Precip12h: number | null;

    @ApiProperty({
        description: 'Precipitation threshold level 2 accumulated in 12h (mm)',
        example: 80,
        nullable: true,
    })
    umbral2Precip12h: number | null;

    @ApiProperty({
        description: 'Precipitation threshold level 3 accumulated in 12h (mm)',
        example: 120,
        nullable: true,
    })
    umbral3Precip12h: number | null;
}
