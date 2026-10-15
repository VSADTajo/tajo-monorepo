import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ApiError } from '@domain/errors/api.error';
import { IMeteoalertaZoneRepository } from '@domain/ports/meteoalerta-zone-repository.port';
import { MeteoalertaZoneThresholdResult } from '@domain/results/meteoalerta-zone-threshold.result';

// ─────────────────────────────────────────────────────────────
// GetMeteoalertaZoneThresholdsByPoint
// ─────────────────────────────────────────────────────────────

export interface IGetMeteoalertaZoneThresholdsByPointQuery {
    latitude: number;
    longitude: number;
}

export class GetMeteoalertaZoneThresholdsByPointQuery {
    constructor(private readonly parameters: IGetMeteoalertaZoneThresholdsByPointQuery) {}
    get latitude(): number {
        return this.parameters.latitude;
    }
    get longitude(): number {
        return this.parameters.longitude;
    }
}

@QueryHandler(GetMeteoalertaZoneThresholdsByPointQuery)
export class GetMeteoalertaZoneThresholdsByPointHandler implements IQueryHandler<
    GetMeteoalertaZoneThresholdsByPointQuery,
    MeteoalertaZoneThresholdResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly meteoalertaZoneRepository: IMeteoalertaZoneRepository,
    ) {}

    async execute(query: GetMeteoalertaZoneThresholdsByPointQuery): Promise<MeteoalertaZoneThresholdResult> {
        this.logger.debug(`Looking up meteoalerta zone for lat=${query.latitude} lon=${query.longitude}`);

        const zone = await this.meteoalertaZoneRepository.findThresholdsByPoint(query.latitude, query.longitude);
        if (!zone) {
            throw new ApiError(
                HttpStatus.NOT_FOUND,
                `No meteoalerta zone contains the point lat=${query.latitude} lon=${query.longitude}`,
            );
        }

        return zone;
    }
}
