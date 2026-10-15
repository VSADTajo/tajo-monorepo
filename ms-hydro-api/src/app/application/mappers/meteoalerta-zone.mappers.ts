import {
    GetMeteoalertaZoneThresholdsRequestDto,
    GetMeteoalertaZoneThresholdsResponseDto,
} from '@api/dtos/meteoalerta-zone.dtos';
import { GetMeteoalertaZoneThresholdsByPointQuery } from '@application/queries/meteoalerta-zone.queries';
import { MeteoalertaZoneThresholdResult } from '@domain/results/meteoalerta-zone-threshold.result';

// ─────────────────────────────────────────────────────────────
// GetMeteoalertaZoneThresholdsByPoint
// ─────────────────────────────────────────────────────────────

export class GetMeteoalertaZoneThresholdsMapper {
    static toQuery(dto: GetMeteoalertaZoneThresholdsRequestDto): GetMeteoalertaZoneThresholdsByPointQuery {
        return new GetMeteoalertaZoneThresholdsByPointQuery({ latitude: dto.lat, longitude: dto.lon });
    }

    static toResponseDto(result: MeteoalertaZoneThresholdResult): GetMeteoalertaZoneThresholdsResponseDto {
        return {
            zonaCode: result.zonaCode,
            zonaNombre: result.zonaNombre,
            provincia: result.provincia,
            ccaa: result.ccaa,
            umbral1Precip1h: result.umbral1Precip1h,
            umbral2Precip1h: result.umbral2Precip1h,
            umbral3Precip1h: result.umbral3Precip1h,
            umbral1Precip12h: result.umbral1Precip12h,
            umbral2Precip12h: result.umbral2Precip12h,
            umbral3Precip12h: result.umbral3Precip12h,
        };
    }
}
