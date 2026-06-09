import { SyncGeoserverResult } from '@domain/results/sync.results';
import { SyncGeoserverResponseDto } from '@api/dtos/sync.dtos';

// ─────────────────────────────────────────────────────────────
// SyncGeoserver
// ─────────────────────────────────────────────────────────────

export class SyncGeoserverMapper {
    static toResponseDto(result: SyncGeoserverResult): SyncGeoserverResponseDto {
        return {
            basinsCreated: result.basinsCreated,
            basinsUpdated: result.basinsUpdated,
            subBasinsCreated: result.subBasinsCreated,
            subBasinsUpdated: result.subBasinsUpdated,
            stationsCreated: result.stationsCreated,
            stationsUpdated: result.stationsUpdated,
            thresholdsCreated: result.thresholdsCreated,
            thresholdsUpdated: result.thresholdsUpdated,
            errors: result.errors,
        };
    }
}
