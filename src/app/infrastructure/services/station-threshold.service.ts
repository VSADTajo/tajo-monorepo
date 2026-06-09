import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { TracedHttpClient } from 'tajo-toolkit';

import { IStationThresholdService } from '@domain/ports/station-threshold-service.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { HydroApiConfigService } from '@config/hydro-api/hydro-api-config.service';

@Injectable()
export class StationThresholdService implements IStationThresholdService {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly cacheService: ICacheService,
        private readonly hydroApiConfig: HydroApiConfigService,
        private readonly tracedHttp: TracedHttpClient,
    ) {}

    async getThreshold(stationId: string): Promise<number | null> {
        const cacheKey = `station-threshold:${stationId}`;

        const cached = await this.cacheService.get<number>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const response = await this.tracedHttp.get(`${this.hydroApiConfig.baseUrl}/stations/by-code/${stationId}`, {
                headers: { 'x-internal-caller': 'ms-predictions-api' },
            });

            const data = response.data;
            const threshold = data.threshold;

            // Use first available threshold: caudal > nivel > volumen
            const umbral = threshold?.umbralCaudal1 ?? threshold?.umbralNivel1 ?? threshold?.umbralVolumen1 ?? null;

            if (umbral !== null) {
                await this.cacheService.set(cacheKey, umbral, this.hydroApiConfig.stationThresholdCacheTtl);
            }

            return umbral;
        } catch (error) {
            this.logger.warn({
                msg: 'Station threshold fetch failed',
                entity: 'Predictions',
                stationId,
                error: String(error),
            });
            return null;
        }
    }
}
