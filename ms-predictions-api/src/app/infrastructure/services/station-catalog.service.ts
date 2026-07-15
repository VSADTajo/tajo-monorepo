import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { TracedHttpClient } from 'tajo-toolkit';

import {
    FullStationCatalogItem,
    IStationCatalogService,
    StationCatalogItem,
} from '@domain/ports/station-catalog-service.port';
import { HydroApiConfigService } from '@config/hydro-api/hydro-api-config.service';

// Single page large enough to fetch the whole catalog in one request.
const CATALOG_PAGE_LIMIT = 10000;

// Every field returned by ms-hydro-api's /stations endpoint (full CreateStationResponseDto shape).
// stationCode is the only always-present field; the rest may be missing/null in older records.
type HydroStationItem = {
    stationCode: string;
    name?: string | null;
} & Partial<Omit<FullStationCatalogItem, 'stationCode' | 'name'>>;

interface HydroListStationsResponse {
    items?: HydroStationItem[];
    total?: number;
}

@Injectable()
export class StationCatalogService implements IStationCatalogService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly hydroApiConfig: HydroApiConfigService,
        private readonly tracedHttp: TracedHttpClient,
    ) {}

    private async fetchHydroStations(): Promise<HydroStationItem[]> {
        try {
            const response = await this.tracedHttp.get<HydroListStationsResponse>(
                `${this.hydroApiConfig.baseUrl}/stations?limit=${CATALOG_PAGE_LIMIT}`,
                { headers: { 'x-internal-caller': 'ms-predictions-api' } },
            );
            return response.data?.items ?? [];
        } catch (error) {
            this.logger.warn({
                msg: 'Station catalog fetch from hydro-api failed; falling back to empty catalog',
                entity: 'Predictions',
                error: String(error),
            });
            return [];
        }
    }

    async listStations(): Promise<StationCatalogItem[]> {
        const items = await this.fetchHydroStations();
        return items.map((s) => ({ code: s.stationCode, name: s.name ?? null }));
    }

    async listFullStations(): Promise<FullStationCatalogItem[]> {
        const items = await this.fetchHydroStations();
        return items.map((s) => ({
            id: s.id ?? '',
            name: s.name ?? '',
            subBasinName: s.subBasinName ?? '',
            stationCode: s.stationCode,
            stationType: s.stationType ?? '',
            subBasinId: s.subBasinId ?? '',
            threshold: s.threshold ?? null,
            latitude: s.latitude ?? null,
            longitude: s.longitude ?? null,
            altitude: s.altitude ?? null,
            municipio: s.municipio ?? null,
            provincia: s.provincia ?? null,
            ccaa: s.ccaa ?? null,
            tipoCod: s.tipoCod ?? null,
            zona: s.zona ?? null,
            zonaExplOgcFid: s.zonaExplOgcFid ?? null,
            zonaExplNombre: s.zonaExplNombre ?? null,
            comarcaName: s.comarcaName ?? null,
            sistemaName: s.sistemaName ?? null,
            meteoalertaZonaCode: s.meteoalertaZonaCode ?? null,
            meteoalertaZonaNombre: s.meteoalertaZonaNombre ?? null,
            description: s.description ?? null,
            isActive: s.isActive ?? true,
            createdAt: s.createdAt ?? null,
            updatedAt: s.updatedAt ?? null,
        }));
    }
}
