import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AEMET_EVENT_TYPE_CODES, TAJO_PROVINCE_CODES } from '@domain/types/aemet.constants';

// ─────────────────────────────────────────────────────────────
// GetAvisos (query params)
// ─────────────────────────────────────────────────────────────

export class GetAvisosQueryDto {
    @ApiPropertyOptional({
        description: 'AEMET event type code (e.g., AT, BT, PR, TO, VI)',
        example: 'AT',
    })
    @IsOptional()
    @IsString()
    @IsIn([...AEMET_EVENT_TYPE_CODES])
    tipo?: string;

    @ApiPropertyOptional({
        description: 'INE province code within the Tajo basin (e.g., 05, 28, 45)',
        example: '28',
    })
    @IsOptional()
    @IsString()
    @IsIn([...TAJO_PROVINCE_CODES])
    provincia?: string;
}

// ─────────────────────────────────────────────────────────────
// GetAvisos Response DTOs
// ─────────────────────────────────────────────────────────────

export class AvisosFeaturePropertiesDto {
    @ApiProperty({ example: '2.49.0.0.724.0.2026052612...' }) identifier: string;
    @ApiProperty({ example: 'http://www.aemet.es' }) sender: string;
    @ApiProperty({ example: '2026-05-26T12:00:00+02:00' }) sent: string;
    @ApiProperty({ example: 'Actual' }) status: string;
    @ApiProperty({ example: 'Alert' }) msgType: string;
    @ApiProperty({ example: 'es-ES' }) language: string;
    @ApiProperty({ example: 'Met' }) category: string;
    @ApiProperty({ example: 'Aviso de temperaturas máximas de nivel amarillo' }) event: string;
    @ApiProperty({ example: 'Monitor' }) responseType: string;
    @ApiProperty({ example: 'Future' }) urgency: string;
    @ApiProperty({ example: 'Moderate' }) severity: string;
    @ApiProperty({ example: 'Likely' }) certainty: string;
    @ApiProperty({ example: '2026-05-26T12:00:00+02:00' }) effective: string;
    @ApiProperty({ example: '2026-05-26T14:00:00+02:00' }) onset: string;
    @ApiProperty({ example: '2026-05-27T06:00:00+02:00' }) expires: string;
    @ApiProperty({ example: 'AEMET. Agencia Estatal de Meteorología' }) senderName: string;
    @ApiProperty({ example: 'Aviso de temperaturas máximas de nivel amarillo. Meseta de Ávila' }) headline: string;
    @ApiProperty({ example: 'Temperatura máxima: 38 ºC.' }) description: string;
    @ApiProperty({ example: 'Esté atento.' }) instruction: string;
    @ApiProperty({ example: 'https://www.aemet.es/es/eltiempo/prediccion/avisos' }) web: string;
    @ApiProperty({ example: 'AEMET' }) contact: string;
    @ApiProperty({ example: 'Meseta de Ávila' }) areaDesc: string;
    @ApiProperty({ description: 'AEMET zone geocode', example: '670501' }) geocode: string;
    @ApiProperty({ description: 'AEMET event type code', example: 'AT' }) eventTypeCode: string;
    @ApiProperty({ description: 'AEMET event type name', example: 'Temperaturas máximas' }) eventTypeName: string;
    @ApiProperty({ description: 'INE province code derived from geocode', example: '05' }) provinciaCode: string;
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
// GetAvisosTipos
// ─────────────────────────────────────────────────────────────

export class AvisoTipoDto {
    @ApiProperty({ description: 'AEMET event type code', example: 'AT' }) code: string;
    @ApiProperty({ description: 'AEMET event type name', example: 'Temperaturas máximas' }) name: string;
}

export class GetAvisosTiposResponseDto {
    @ApiProperty({ type: [AvisoTipoDto] }) tipos: AvisoTipoDto[];
}

// ─────────────────────────────────────────────────────────────
// GetAvisosResumen
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
