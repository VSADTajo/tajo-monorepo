import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { Basin } from '@domain/entities/basin.entity';
import { IBasinRepository } from '@domain/ports/basin-repository.port';
import {
    CreateBasinResult,
    UpdateBasinResult,
    ToggleBasinResult,
    DeleteBasinResult,
} from '@domain/results/basin.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { ICacheService } from '@domain/ports/cache-service.port';
import { BasinCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateBasin
// ─────────────────────────────────────────────────────────────

export interface ICreateBasinCommand {
    name: string;
    code: string;
    description?: string;
}

export class CreateBasinCommand {
    constructor(private readonly parameters: ICreateBasinCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get code(): string {
        return this.parameters.code;
    }

    get description(): string | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(CreateBasinCommand)
export class CreateBasinHandler implements ICommandHandler<CreateBasinCommand, CreateBasinResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly basinRepository: IBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateBasinCommand): Promise<CreateBasinResult> {
        this.logger.log({ msg: 'Creating basin', entity: 'Basins', name: command.name });

        // 1. Build entity and validate invariants
        const basin = new Basin({
            name: command.name,
            code: command.code,
            description: command.description ?? null,
        });
        basin.validate();

        // 2. Check duplicate name
        const existingByName = await this.basinRepository.findByName(basin.name);
        if (existingByName) {
            throw new ApiError(HttpStatus.CONFLICT, `Basin with name "${basin.name}" already exists`);
        }

        // 3. Check duplicate code
        const existingByCode = await this.basinRepository.findByCode(basin.code);
        if (existingByCode) {
            throw new ApiError(HttpStatus.CONFLICT, `Basin with code "${basin.code}" already exists`);
        }

        // 4. Persist basin
        const persistedBasin = await this.basinRepository.create(basin);

        this.logger.log({ msg: 'Basin created', entity: 'Basins', id: persistedBasin.id, name: persistedBasin.name });

        await this.cacheService.delByPattern(BasinCacheKeys.pattern());

        return new CreateBasinResult({
            id: persistedBasin.id,
            name: persistedBasin.name,
            code: persistedBasin.code,
            description: persistedBasin.description,
            isActive: persistedBasin.isActive,
            createdAt: persistedBasin.createdAt!,
            updatedAt: persistedBasin.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateBasin
// ─────────────────────────────────────────────────────────────

export interface IUpdateBasinCommand {
    id: string;
    name?: string;
    code?: string;
    description?: string | null;
}

export class UpdateBasinCommand {
    constructor(private readonly parameters: IUpdateBasinCommand) {}
    get id(): string {
        return this.parameters.id;
    }
    get name(): string | undefined {
        return this.parameters.name;
    }
    get code(): string | undefined {
        return this.parameters.code;
    }
    get description(): string | null | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(UpdateBasinCommand)
export class UpdateBasinHandler implements ICommandHandler<UpdateBasinCommand, UpdateBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly basinRepository: IBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateBasinCommand): Promise<UpdateBasinResult> {
        this.logger.log({ msg: 'Updating basin', entity: 'Basins', id: command.id });

        let basin;
        try {
            basin = await this.basinRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Basin with id "${command.id}" not found`);
            }
            throw error;
        }

        if (command.name !== undefined) basin.name = command.name;
        if (command.code !== undefined) basin.code = command.code;
        if (command.description !== undefined) basin.description = command.description;

        basin.validate();

        if (command.name !== undefined) {
            const existingByName = await this.basinRepository.findByName(basin.name);
            if (existingByName && existingByName.id !== basin.id) {
                throw new ApiError(HttpStatus.CONFLICT, `Basin with name "${basin.name}" already exists`);
            }
        }

        if (command.code !== undefined) {
            const existingByCode = await this.basinRepository.findByCode(basin.code);
            if (existingByCode && existingByCode.id !== basin.id) {
                throw new ApiError(HttpStatus.CONFLICT, `Basin with code "${basin.code}" already exists`);
            }
        }

        const updatedBasin = await this.basinRepository.update(basin);

        this.logger.log({ msg: 'Basin updated', entity: 'Basins', id: updatedBasin.id });
        await this.cacheService.del(BasinCacheKeys.byId(updatedBasin.id));
        await this.cacheService.delByPattern(BasinCacheKeys.pattern());

        return new UpdateBasinResult({
            id: updatedBasin.id,
            name: updatedBasin.name,
            code: updatedBasin.code,
            description: updatedBasin.description,
            isActive: updatedBasin.isActive,
            createdAt: updatedBasin.createdAt!,
            updatedAt: updatedBasin.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleBasin
// ─────────────────────────────────────────────────────────────

export interface IToggleBasinCommand {
    id: string;
}

export class ToggleBasinCommand {
    constructor(private readonly parameters: IToggleBasinCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(ToggleBasinCommand)
export class ToggleBasinHandler implements ICommandHandler<ToggleBasinCommand, ToggleBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly basinRepository: IBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ToggleBasinCommand): Promise<ToggleBasinResult> {
        this.logger.log({ msg: 'Toggling basin', entity: 'Basins', id: command.id });

        let basin;
        try {
            basin = await this.basinRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Basin with id "${command.id}" not found`);
            }
            throw error;
        }

        basin.toggleActive();
        const updatedBasin = await this.basinRepository.update(basin);

        this.logger.log({
            msg: 'Basin toggled',
            entity: 'Basins',
            id: updatedBasin.id,
            isActive: updatedBasin.isActive,
        });
        await this.cacheService.del(BasinCacheKeys.byId(updatedBasin.id));
        await this.cacheService.delByPattern(BasinCacheKeys.pattern());

        return new ToggleBasinResult({
            id: updatedBasin.id,
            name: updatedBasin.name,
            code: updatedBasin.code,
            isActive: updatedBasin.isActive,
            updatedAt: updatedBasin.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteBasin (soft delete — set isActive=false, idempotent)
// ─────────────────────────────────────────────────────────────

export interface IDeleteBasinCommand {
    id: string;
}

export class DeleteBasinCommand {
    constructor(private readonly parameters: IDeleteBasinCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteBasinCommand)
export class DeleteBasinHandler implements ICommandHandler<DeleteBasinCommand, DeleteBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly basinRepository: IBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteBasinCommand): Promise<DeleteBasinResult> {
        this.logger.log({ msg: 'Deleting basin', entity: 'Basins', id: command.id });

        let basin;
        try {
            basin = await this.basinRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Basin with id "${command.id}" not found`);
            }
            throw error;
        }

        basin.isActive = false;
        const updatedBasin = await this.basinRepository.update(basin);

        this.logger.log({
            msg: 'Basin deleted (soft)',
            entity: 'Basins',
            id: updatedBasin.id,
            isActive: updatedBasin.isActive,
        });
        await this.cacheService.del(BasinCacheKeys.byId(updatedBasin.id));
        await this.cacheService.delByPattern(BasinCacheKeys.pattern());

        return new DeleteBasinResult({
            id: updatedBasin.id,
            name: updatedBasin.name,
            code: updatedBasin.code,
            isActive: updatedBasin.isActive,
            updatedAt: updatedBasin.updatedAt!,
        });
    }
}
