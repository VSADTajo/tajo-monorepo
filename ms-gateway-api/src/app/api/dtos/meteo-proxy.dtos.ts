import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// MeteoInfo
// ─────────────────────────────────────────────────────────────

export class MeteoBboxDto {
    @ApiProperty({ example: -7.5438 }) minX: number;
    @ApiProperty({ example: 38.7845 }) minY: number;
    @ApiProperty({ example: -1.4508 }) maxX: number;
    @ApiProperty({ example: 41.3045 }) maxY: number;
}

export class MeteoInfoBodyDto {
    @ApiProperty({ example: 'Precipitación' }) nombre: string;
    @ApiProperty({ example: '2026-04-08T12:00:00.000Z' }) fechaInicio: string;
    @ApiProperty({ example: '2026-04-09T11:00:00.000Z' }) fechaFin: string;
    @ApiProperty({ example: 60, description: 'Time step in minutes' }) pasoDeTiempo: number;
    @ApiProperty({ example: 'mm' }) unidad: string;
    @ApiProperty({ example: 677 }) ncols: number;
    @ApiProperty({ example: 280 }) nrows: number;
    @ApiProperty({ type: MeteoBboxDto }) bbox: MeteoBboxDto;
    @ApiProperty({ example: 0.009 }) cellsize: number;
    @ApiProperty({ example: -999 }) nodata: number;
}

export class MeteoLastRunDto {
    @ApiProperty({ nullable: true, example: '2026-04-08T18:00:00.000Z' }) startedAt: string | null;
    @ApiProperty({ nullable: true, example: '2026-04-08T18:02:14.000Z' }) finishedAt: string | null;
    @ApiProperty({ example: 'ok', enum: ['running', 'ok', 'partial', 'failed', 'noop'] }) status: string;
    @ApiProperty({ example: 72 }) filesOk: number;
    @ApiProperty({ example: 0 }) filesFailed: number;
}

export class MeteoInfoResponseDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({ nullable: true, example: 'Precipitacion' }) variable: string | null;
    @ApiProperty({ example: 'Tajo:harmonie_precipitacion' }) layerName: string;
    @ApiProperty({ type: MeteoInfoBodyDto }) info: MeteoInfoBodyDto;
    @ApiProperty({ type: MeteoLastRunDto, nullable: true }) lastRun: MeteoLastRunDto | null;
}

// ─────────────────────────────────────────────────────────────
// MeteoProviders
// ─────────────────────────────────────────────────────────────

export class MeteoProviderDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({
        type: [String],
        example: ['Precipitacion', 'Temperatura', 'Viento', 'Nubosidad', 'Rayos', 'CoberturaNieve'],
    })
    variables: string[];
}

// ─────────────────────────────────────────────────────────────
// MeteoSync
// ─────────────────────────────────────────────────────────────

export class DatasetSyncResultDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiProperty({ nullable: true, example: 'Precipitacion' }) variable: string | null;
    @ApiProperty({ example: 'ok', enum: ['ok', 'partial', 'failed', 'noop'] }) status: string;
    @ApiProperty({ example: 72 }) filesOk: number;
    @ApiProperty({ example: 0 }) filesFailed: number;
    @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' }) runId: string | null;
}

export class SyncResultDto {
    @ApiProperty({ example: 'manual', enum: ['cron', 'manual'] }) triggeredBy: string;
    @ApiProperty({ type: [DatasetSyncResultDto] }) datasets: DatasetSyncResultDto[];
}

// ─────────────────────────────────────────────────────────────
// MeteoAccumulate
// ─────────────────────────────────────────────────────────────

export class AccumulateResponseDto {
    @ApiProperty({ example: 'HARMONIE' }) provider: string;
    @ApiPropertyOptional({ nullable: true, example: 'Precipitacion' }) variable: string | null;
    @ApiProperty({ example: 'Tajo:harmonie_precipitacion_acumulado' }) layerName: string;
    @ApiProperty({ example: '2026-05-01T00:00:00.000Z' }) from: string;
    @ApiProperty({ example: '2026-05-10T00:00:00.000Z' }) to: string;
    @ApiProperty({ example: 240 }) filesUsed: number;
}

// ─────────────────────────────────────────────────────────────
// Avisos AEMET
// ─────────────────────────────────────────────────────────────

export class AvisosFeaturePropertiesDto {
    @ApiProperty({ example: '2.49.0.0.724.0.2026052612...' }) identifier: string;
    @ApiProperty({ example: 'Aviso de temperaturas máximas de nivel amarillo' }) event: string;
    @ApiProperty({ example: 'Moderate' }) severity: string;
    @ApiProperty({ example: 'Meseta de Ávila' }) areaDesc: string;
    @ApiProperty({ description: 'AEMET zone geocode', example: '670501' }) geocode: string;
    @ApiProperty({ description: 'AEMET event type code', example: 'AT' }) eventTypeCode: string;
    @ApiProperty({ description: 'AEMET event type name', example: 'Temperaturas máximas' }) eventTypeName: string;
    @ApiProperty({ description: 'INE province code', example: '05' }) provinciaCode: string;
    @ApiProperty({ description: 'AEMET alert level', example: 'amarillo' }) level: string;
}

export class AvisosFeatureDto {
    @ApiProperty({ example: 'Feature' }) type: string;
    @ApiProperty({
        example: {
            type: 'Polygon',
            coordinates: [
                [
                    [-3.7, 40.4],
                    [-3.6, 40.5],
                ],
            ],
        },
    })
    geometry: object;
    @ApiProperty({ type: AvisosFeaturePropertiesDto }) properties: AvisosFeaturePropertiesDto;
}

export class GetAvisosResponseDto {
    @ApiProperty({ example: 'FeatureCollection' }) type: string;
    @ApiProperty({ type: [AvisosFeatureDto] }) features: AvisosFeatureDto[];
}

// ─────────────────────────────────────────────────────────────
// Avisos Tipos
// ─────────────────────────────────────────────────────────────

export class AvisoTipoDto {
    @ApiProperty({ description: 'AEMET event type code', example: 'AT' }) code: string;
    @ApiProperty({ description: 'AEMET event type name', example: 'Temperaturas máximas' }) name: string;
}

export class GetAvisosTiposResponseDto {
    @ApiProperty({ type: [AvisoTipoDto] }) tipos: AvisoTipoDto[];
}

// ─────────────────────────────────────────────────────────────
// Avisos Resumen
// ─────────────────────────────────────────────────────────────

export class CategoriaActivaDto {
    @ApiProperty({ description: 'AEMET event type code', example: 'AT' }) code: string;
    @ApiProperty({ description: 'AEMET event type name', example: 'Temperaturas máximas' }) name: string;
    @ApiProperty({ description: 'Number of active alerts in this category', example: 3 }) count: number;
}

export class GetAvisosResumenResponseDto {
    @ApiProperty({ type: [CategoriaActivaDto], description: 'Categories with active alerts' })
    categoriasActivas: CategoriaActivaDto[];

    @ApiProperty({ description: 'Total number of active alerts', example: 4 })
    totalAvisos: number;
}
