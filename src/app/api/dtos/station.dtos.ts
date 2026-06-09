import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { StationType } from '@domain/types/station-type.enum';

// ─────────────────────────────────────────────────────────────
// StationThresholdDto (shared response shape)
// ─────────────────────────────────────────────────────────────

export class StationThresholdDto {
    @ApiProperty({ description: 'Threshold ID' })
    id: string;

    @ApiProperty({ description: 'Station ID' })
    stationId: string;

    @ApiProperty({ description: 'Measurement parameter type', example: 'NIVEL', nullable: true })
    parametro: string | null;

    @ApiProperty({ description: 'SAIH signal code', example: 'AR01LI__01', nullable: true })
    senal: string | null;

    @ApiProperty({ description: 'Level threshold 1 (pre-alert)', nullable: true })
    umbralNivel1: number | null;

    @ApiProperty({ description: 'Flow threshold 1', nullable: true })
    umbralCaudal1: number | null;

    @ApiProperty({ description: 'Level threshold 2 (alert)', nullable: true })
    umbralNivel2: number | null;

    @ApiProperty({ description: 'Flow threshold 2', nullable: true })
    umbralCaudal2: number | null;

    @ApiProperty({ description: 'Level threshold 3 (alarm)', nullable: true })
    umbralNivel3: number | null;

    @ApiProperty({ description: 'Flow threshold 3', nullable: true })
    umbralCaudal3: number | null;

    @ApiProperty({ description: 'Max wall level', nullable: true })
    maxNivelMuro: number | null;

    @ApiProperty({ description: 'Max booth level', nullable: true })
    maxNivelCaseta: number | null;

    @ApiProperty({ description: 'Volume threshold 1', nullable: true })
    umbralVolumen1: number | null;

    @ApiProperty({ description: 'Volume threshold 2', nullable: true })
    umbralVolumen2: number | null;

    @ApiProperty({ description: 'Volume threshold 3', nullable: true })
    umbralVolumen3: number | null;

    @ApiProperty({ description: 'Inflow rate', nullable: true })
    caudalEntrada: number | null;

    @ApiProperty({ description: 'Outflow rate', nullable: true })
    caudalSalida: number | null;

    @ApiProperty({ description: 'Reservoir capacity', nullable: true })
    capacidad: number | null;
}

// ─────────────────────────────────────────────────────────────
// CreateStation
// ─────────────────────────────────────────────────────────────

export class CreateStationRequestDto {
    @ApiProperty({
        description: 'Station name',
        example: 'Estación Río Negro',
    })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({
        description: 'Sub-basin name (denormalized for display)',
        example: 'Río Negro Alto',
    })
    @IsNotEmpty()
    @IsString()
    subBasinName: string;

    @ApiProperty({
        description: 'Unique station code',
        example: 'EST-001',
    })
    @IsNotEmpty()
    @IsString()
    stationCode: string;

    @ApiProperty({
        description: 'Station type',
        enum: StationType,
        example: StationType.AFORO_EN_RIO,
    })
    @IsNotEmpty()
    @IsEnum(StationType)
    stationType: StationType;

    @ApiProperty({
        description: 'Sub-basin ID (FK)',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty()
    @IsUUID()
    subBasinId: string;

    @ApiProperty({
        description: 'Latitude coordinate',
        example: -34.9011,
        required: false,
        nullable: true,
    })
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiProperty({
        description: 'Longitude coordinate',
        example: -56.1645,
        required: false,
        nullable: true,
    })
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiProperty({
        description: 'Altitude in meters',
        example: 136.0,
        required: false,
        nullable: true,
    })
    @IsOptional()
    @IsNumber()
    altitude?: number;

    @ApiProperty({
        description: 'Optional station description',
        example: 'Estación de monitoreo en el tramo alto del Río Negro',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;
}

export class CreateStationResponseDto {
    @ApiProperty({
        description: 'Station ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Station name',
        example: 'Estación Río Negro',
    })
    name: string;

    @ApiProperty({
        description: 'Sub-basin name',
        example: 'Río Negro Alto',
    })
    subBasinName: string;

    @ApiProperty({
        description: 'Station code',
        example: 'EST-001',
    })
    stationCode: string;

    @ApiProperty({
        description: 'Station type',
        enum: StationType,
        example: StationType.AFORO_EN_RIO,
    })
    stationType: string;

    @ApiProperty({
        description: 'Sub-basin ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    subBasinId: string;

    @ApiProperty({
        description: 'Station threshold data',
        nullable: true,
    })
    threshold: StationThresholdDto | null;

    @ApiProperty({
        description: 'Latitude coordinate',
        example: -34.9011,
        nullable: true,
    })
    latitude: number | null;

    @ApiProperty({
        description: 'Longitude coordinate',
        example: -56.1645,
        nullable: true,
    })
    longitude: number | null;

    @ApiProperty({
        description: 'Altitude in meters',
        example: 136.0,
        nullable: true,
    })
    altitude: number | null;

    @ApiProperty({
        description: 'Municipality',
        example: 'Sacedón',
        nullable: true,
    })
    municipio: string | null;

    @ApiProperty({
        description: 'Province',
        example: 'Guadalajara',
        nullable: true,
    })
    provincia: string | null;

    @ApiProperty({
        description: 'Autonomous community',
        example: 'Castilla La Mancha',
        nullable: true,
    })
    ccaa: string | null;

    @ApiProperty({
        description: 'Station type code from SAIH network',
        example: 'AC',
        nullable: true,
    })
    tipoCod: string | null;

    @ApiProperty({
        description: 'SAIH zone name',
        example: 'CABECERA',
        nullable: true,
    })
    zona: string | null;

    @ApiProperty({
        description: 'Exploitation zone ogc_fid from cht_zonas_expl',
        example: 2,
        nullable: true,
    })
    zonaExplOgcFid: number | null;

    @ApiProperty({
        description: 'Exploitation zone name from cht_zonas_expl',
        example: 'ZONA 2',
        nullable: true,
    })
    zonaExplNombre: string | null;

    @ApiProperty({
        description: 'Agricultural district name',
        example: 'TALAVERA DE LA REINA',
        nullable: true,
    })
    comarcaName: string | null;

    @ApiProperty({
        description: 'Water system name',
        example: 'CABECERA',
        nullable: true,
    })
    sistemaName: string | null;

    @ApiProperty({
        description: 'Station description',
        example: 'Estación de monitoreo en el tramo alto del Río Negro',
        nullable: true,
    })
    description: string | null;

    @ApiProperty({
        description: 'Whether the station is active',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2026-03-12T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last update timestamp',
        example: '2026-03-12T00:00:00.000Z',
    })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// GetStation
// ─────────────────────────────────────────────────────────────

export class GetStationResponseDto extends CreateStationResponseDto {}

// ─────────────────────────────────────────────────────────────
// GetStationBySubBasinName
// ─────────────────────────────────────────────────────────────

export class GetStationBySubBasinNameResponseDto extends CreateStationResponseDto {}

// ─────────────────────────────────────────────────────────────
// UpdateThreshold
// ─────────────────────────────────────────────────────────────

export class UpdateThresholdRequestDto {
    @ApiProperty({ description: 'Measurement parameter type', example: 'NIVEL', required: false, nullable: true })
    @IsOptional()
    @IsString()
    parametro?: string | null;

    @ApiProperty({ description: 'SAIH signal code', example: 'AR01LI__01', required: false, nullable: true })
    @IsOptional()
    @IsString()
    senal?: string | null;

    @ApiProperty({ description: 'Level threshold 1 (pre-alert)', example: 0.95, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralNivel1?: number | null;

    @ApiProperty({ description: 'Flow threshold 1', example: 6.06, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralCaudal1?: number | null;

    @ApiProperty({ description: 'Level threshold 2 (alert)', example: 1.2, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralNivel2?: number | null;

    @ApiProperty({ description: 'Flow threshold 2', example: 11.53, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralCaudal2?: number | null;

    @ApiProperty({ description: 'Level threshold 3 (alarm)', example: 1.4, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralNivel3?: number | null;

    @ApiProperty({ description: 'Flow threshold 3', example: 17.65, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralCaudal3?: number | null;

    @ApiProperty({ description: 'Max wall level', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    maxNivelMuro?: number | null;

    @ApiProperty({ description: 'Max booth level', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    maxNivelCaseta?: number | null;

    @ApiProperty({ description: 'Volume threshold 1', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralVolumen1?: number | null;

    @ApiProperty({ description: 'Volume threshold 2', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralVolumen2?: number | null;

    @ApiProperty({ description: 'Volume threshold 3', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    umbralVolumen3?: number | null;

    @ApiProperty({ description: 'Inflow rate', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    caudalEntrada?: number | null;

    @ApiProperty({ description: 'Outflow rate', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    caudalSalida?: number | null;

    @ApiProperty({ description: 'Reservoir capacity', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    capacidad?: number | null;
}

export class UpdateThresholdResponseDto {
    @ApiProperty({ description: 'Threshold ID' })
    id: string;

    @ApiProperty({ description: 'Station ID' })
    stationId: string;

    @ApiProperty({ description: 'Station code', example: 'AR01' })
    stationCode: string;

    @ApiProperty({ description: 'Threshold data' })
    threshold: StationThresholdDto;

    @ApiProperty({ description: 'Last update timestamp' })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// GetThreshold
// ─────────────────────────────────────────────────────────────

export class GetThresholdResponseDto {
    @ApiProperty({ description: 'Station ID' })
    stationId: string;

    @ApiProperty({ description: 'Station code', example: 'AR01' })
    stationCode: string;

    @ApiProperty({ description: 'Threshold data', nullable: true })
    threshold: StationThresholdDto | null;
}

// ─────────────────────────────────────────────────────────────
// ListStations
// ─────────────────────────────────────────────────────────────

export class ListStationsRequestDto {
    @ApiProperty({ description: 'Page number', example: 1, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number;

    @ApiProperty({ description: 'Items per page', example: 10, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;

    @ApiProperty({ description: 'Filter by sub-basin ID', required: false })
    @IsOptional()
    @IsUUID()
    subBasinId?: string;

    @ApiProperty({ description: 'Filter by station type', enum: StationType, required: false })
    @IsOptional()
    @IsEnum(StationType)
    stationType?: StationType;

    @ApiProperty({ description: 'Filter by active status', required: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    isActive?: boolean;

    @ApiProperty({ description: 'Filter by SAIH zone name (exact match)', example: 'CABECERA', required: false })
    @IsOptional()
    @IsString()
    zona?: string;

    @ApiProperty({ description: 'Filter by exploitation zone ogc_fid (exact match)', example: 2, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    zonaExplOgcFid?: number;

    @ApiProperty({ description: 'Filter by exploitation zone name (exact match)', example: 'ZONA 2', required: false })
    @IsOptional()
    @IsString()
    zonaExplNombre?: string;

    @ApiProperty({ description: 'Filter by sub-basin name', example: 'EL ATAZAR', required: false })
    @IsOptional()
    @IsString()
    subBasinName?: string;

    @ApiProperty({ description: 'Filter by agricultural district name', example: 'LOZOYA SOMOSIERRA', required: false })
    @IsOptional()
    @IsString()
    comarcaName?: string;

    @ApiProperty({ description: 'Filter by water system name', example: 'MADRID', required: false })
    @IsOptional()
    @IsString()
    sistemaName?: string;

    @ApiProperty({ description: 'Filter by station code', example: 'R504', required: false })
    @IsOptional()
    @IsString()
    stationCode?: string;
}

// ─────────────────────────────────────────────────────────────
// GetStationByCode
// ─────────────────────────────────────────────────────────────

export class GetStationByCodeResponseDto extends CreateStationResponseDto {}

export class ListStationsResponseDto {
    @ApiProperty({ description: 'List of stations', type: [CreateStationResponseDto] })
    items: CreateStationResponseDto[];

    @ApiProperty({ description: 'Total number of matching stations', example: 42 })
    total: number;
}

// ─────────────────────────────────────────────────────────────
// UpdateStation
// ─────────────────────────────────────────────────────────────

export class UpdateStationRequestDto {
    @ApiProperty({ description: 'Station name', example: 'Estación Río Negro', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ description: 'Sub-basin name', example: 'Río Negro Alto', required: false })
    @IsOptional()
    @IsString()
    subBasinName?: string;

    @ApiProperty({ description: 'Station code', example: 'EST-001', required: false })
    @IsOptional()
    @IsString()
    stationCode?: string;

    @ApiProperty({ description: 'Station type', enum: StationType, required: false })
    @IsOptional()
    @IsEnum(StationType)
    stationType?: StationType;

    @ApiProperty({ description: 'Latitude', example: -34.9011, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    latitude?: number | null;

    @ApiProperty({ description: 'Longitude', example: -56.1645, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    longitude?: number | null;

    @ApiProperty({ description: 'Altitude in meters', example: 136.0, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_obj, value) => value !== null)
    @IsNumber()
    altitude?: number | null;

    @ApiProperty({ description: 'Description', required: false, nullable: true })
    @IsOptional()
    @IsString()
    description?: string | null;
}

export class UpdateStationResponseDto extends CreateStationResponseDto {}

// ─────────────────────────────────────────────────────────────
// ToggleStation
// ─────────────────────────────────────────────────────────────

export class ToggleStationResponseDto {
    @ApiProperty({ description: 'Station ID', example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ description: 'Station name', example: 'Estación Río Negro' })
    name: string;

    @ApiProperty({ description: 'Station code', example: 'EST-001' })
    stationCode: string;

    @ApiProperty({ description: 'Whether the station is active', example: false })
    isActive: boolean;

    @ApiProperty({ description: 'Last update timestamp', example: '2026-03-12T00:00:00.000Z' })
    updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// DeleteStation
// ─────────────────────────────────────────────────────────────

export class DeleteStationResponseDto extends ToggleStationResponseDto {}
