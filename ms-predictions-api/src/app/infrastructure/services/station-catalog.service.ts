import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { TracedHttpClient } from 'tajo-toolkit';

import { IStationCatalogService, StationCatalogItem } from '@domain/ports/station-catalog-service.port';
import { HydroApiConfigService } from '@config/hydro-api/hydro-api-config.service';

// Single page large enough to fetch the whole catalog in one request.
const CATALOG_PAGE_LIMIT = 10000;

interface HydroStationItem {
    stationCode: string;
    name?: string | null;
}

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

    async listStations(): Promise<StationCatalogItem[]> {
        try {
            const response = await this.tracedHttp.get<HydroListStationsResponse>(
                `${this.hydroApiConfig.baseUrl}/stations?limit=${CATALOG_PAGE_LIMIT}`,
                { headers: { 'x-internal-caller': 'ms-predictions-api' } },
            );

            const items = response.data?.items ?? [];
            return items.map((s) => ({ code: s.stationCode, name: s.name ?? null }));
        } catch (error) {
            this.logger.warn({
                msg: 'Station catalog fetch from hydro-api failed; falling back to empty catalog',
                entity: 'Predictions',
                error: String(error),
            });
            return [];
        }
    }
}
