import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { PredictionType } from '@domain/entities/prediction-type.entity';
import { PredictionTypeResult } from '@domain/results/prediction-type.result';
import { ApiError } from '@domain/errors/api.error';
import { PredictionTypeCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreatePredictionType
// ─────────────────────────────────────────────────────────────

export interface ICreatePredictionTypeCommand {
    name: string;
    unit: string;
}

export class CreatePredictionTypeCommand {
    constructor(private readonly parameters: ICreatePredictionTypeCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get unit(): string {
        return this.parameters.unit;
    }
}

@CommandHandler(CreatePredictionTypeCommand)
export class CreatePredictionTypeHandler implements ICommandHandler<CreatePredictionTypeCommand, PredictionTypeResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly predictionTypeRepository: IPredictionTypeRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreatePredictionTypeCommand): Promise<PredictionTypeResult> {
        this.logger.log(`Creating prediction type: name=${command.name}, unit=${command.unit}`);

        // 1. Build entity and validate
        const predictionType = new PredictionType({ name: command.name, unit: command.unit });
        predictionType.validate();

        // 2. Check uniqueness
        const existing = await this.predictionTypeRepository.findByName(predictionType.name);
        if (existing) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                `Prediction type with name '${predictionType.name}' already exists`,
            );
        }

        // 3. Persist
        const persisted = await this.predictionTypeRepository.create(predictionType);

        // 4. Invalidate cache
        await this.cacheService.del(PredictionTypeCacheKeys.list());

        return new PredictionTypeResult({
            id: persisted.id,
            name: persisted.name,
            unit: persisted.unit,
        });
    }
}
