import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { Maneuver } from '@domain/entities/maneuver.entity';
import { IManeuverRepository } from '@domain/ports/maneuver-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { ApiError } from '@domain/errors/api.error';
import { ManeuverCacheKeys, ManualSimulationCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateManeuver
// ─────────────────────────────────────────────────────────────

export interface ICreateManeuverCommand {
    reservoirCode: string;
    outputFlowValue: number;
    startDate?: string;
    endDate?: string;
}

export class CreateManeuverCommand {
    constructor(private readonly parameters: ICreateManeuverCommand) {}
    get reservoirCode(): string {
        return this.parameters.reservoirCode;
    }
    get outputFlowValue(): number {
        return this.parameters.outputFlowValue;
    }
    get startDate(): string | undefined {
        return this.parameters.startDate;
    }
    get endDate(): string | undefined {
        return this.parameters.endDate;
    }
}

@CommandHandler(CreateManeuverCommand)
export class CreateManeuverHandler implements ICommandHandler<CreateManeuverCommand, Maneuver> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly maneuverRepository: IManeuverRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateManeuverCommand): Promise<Maneuver> {
        const maneuver = new Maneuver({
            reservoirCode: command.reservoirCode,
            outputFlowValue: command.outputFlowValue,
            startDate: command.startDate ? new Date(command.startDate) : null,
            endDate: command.endDate ? new Date(command.endDate) : null,
        });
        maneuver.validate();

        const created = await this.maneuverRepository.create(maneuver);
        await this.cacheService.delByPattern(ManeuverCacheKeys.pattern());
        await this.cacheService.delByPattern(ManualSimulationCacheKeys.pattern());

        this.logger.log({ msg: 'Maneuver created', entity: 'Maneuvers', maneuverId: created.id });
        return created;
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateManeuver
// ─────────────────────────────────────────────────────────────

export interface IUpdateManeuverCommand {
    id: string;
    reservoirCode?: string;
    outputFlowValue?: number;
    startDate?: string | null;
    endDate?: string | null;
}

export class UpdateManeuverCommand {
    constructor(private readonly parameters: IUpdateManeuverCommand) {}
    get id(): string {
        return this.parameters.id;
    }
    get reservoirCode(): string | undefined {
        return this.parameters.reservoirCode;
    }
    get outputFlowValue(): number | undefined {
        return this.parameters.outputFlowValue;
    }
    get startDate(): string | null | undefined {
        return this.parameters.startDate;
    }
    get endDate(): string | null | undefined {
        return this.parameters.endDate;
    }
}

@CommandHandler(UpdateManeuverCommand)
export class UpdateManeuverHandler implements ICommandHandler<UpdateManeuverCommand, Maneuver> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly maneuverRepository: IManeuverRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateManeuverCommand): Promise<Maneuver> {
        const existing = await this.maneuverRepository.findById(command.id);
        if (!existing) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Maneuver with id "${command.id}" not found`);
        }

        if (command.reservoirCode !== undefined) existing.reservoirCode = command.reservoirCode;
        if (command.outputFlowValue !== undefined) existing.outputFlowValue = command.outputFlowValue;
        // Omitting a date leaves it unchanged; an explicit null clears it; a string sets it.
        if (command.startDate !== undefined) {
            existing.startDate = command.startDate === null ? null : new Date(command.startDate);
        }
        if (command.endDate !== undefined) {
            existing.endDate = command.endDate === null ? null : new Date(command.endDate);
        }
        existing.validate();

        const updated = await this.maneuverRepository.update(existing);
        await this.cacheService.delByPattern(ManeuverCacheKeys.pattern());
        await this.cacheService.delByPattern(ManualSimulationCacheKeys.pattern());

        this.logger.log({ msg: 'Maneuver updated', entity: 'Maneuvers', maneuverId: updated.id });
        return updated;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteManeuver
// ─────────────────────────────────────────────────────────────

export interface IDeleteManeuverCommand {
    id: string;
}

export class DeleteManeuverCommand {
    constructor(private readonly parameters: IDeleteManeuverCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteManeuverCommand)
export class DeleteManeuverHandler implements ICommandHandler<DeleteManeuverCommand, void> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly maneuverRepository: IManeuverRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteManeuverCommand): Promise<void> {
        const existing = await this.maneuverRepository.findById(command.id);
        if (!existing) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Maneuver with id "${command.id}" not found`);
        }

        await this.maneuverRepository.delete(command.id);
        await this.cacheService.delByPattern(ManeuverCacheKeys.pattern());
        await this.cacheService.delByPattern(ManualSimulationCacheKeys.pattern());

        this.logger.log({ msg: 'Maneuver deleted', entity: 'Maneuvers', maneuverId: command.id });
    }
}
