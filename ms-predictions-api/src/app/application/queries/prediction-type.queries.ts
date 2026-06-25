import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { IPredictionRepository } from '@domain/ports/prediction-repository.port';
import { ListPredictionTypesResult, StationPredictionTypesResult } from '@domain/results/prediction-type.result';

// ─────────────────────────────────────────────────────────────
// ListPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListPredictionTypesQuery {}

@QueryHandler(ListPredictionTypesQuery)
export class ListPredictionTypesHandler implements IQueryHandler<ListPredictionTypesQuery, ListPredictionTypesResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionTypeRepository: IPredictionTypeRepository,
    ) {}

    async execute(): Promise<ListPredictionTypesResult> {
        this.logger.debug('Listing all prediction types');

        const predictionTypes = await this.predictionTypeRepository.findAll();

        return new ListPredictionTypesResult(
            predictionTypes.map((pt) => ({
                id: pt.id,
                name: pt.name,
                unit: pt.unit,
            })),
        );
    }
}

// ─────────────────────────────────────────────────────────────
// ListStationPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListStationPredictionTypesQuery {
    constructor(public readonly stationCode: string) {}
}

@QueryHandler(ListStationPredictionTypesQuery)
export class ListStationPredictionTypesHandler implements IQueryHandler<
    ListStationPredictionTypesQuery,
    StationPredictionTypesResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: ListStationPredictionTypesQuery): Promise<StationPredictionTypesResult> {
        this.logger.debug(`Listing prediction types with data for station ${query.stationCode}`);

        const predictionTypes = await this.predictionRepository.findTypesWithDataByStation(query.stationCode);

        return new StationPredictionTypesResult({
            stationCode: query.stationCode,
            predictionTypes: predictionTypes.map((pt) => ({
                id: pt.id,
                name: pt.name,
                unit: pt.unit,
            })),
        });
    }
}
