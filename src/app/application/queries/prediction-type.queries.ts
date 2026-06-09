import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { ListPredictionTypesResult } from '@domain/results/prediction-type.result';

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
