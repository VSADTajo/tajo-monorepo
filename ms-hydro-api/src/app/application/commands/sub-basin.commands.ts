import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { SubBasin } from '@domain/entities/sub-basin.entity';
import { ISubBasinRepository } from '@domain/ports/sub-basin-repository.port';
import { IBasinRepository } from '@domain/ports/basin-repository.port';
import {
    CreateSubBasinResult,
    UpdateSubBasinResult,
    ToggleSubBasinResult,
    DeleteSubBasinResult,
} from '@domain/results/sub-basin.results';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';
import { ICacheService } from '@domain/ports/cache-service.port';
import { SubBasinCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateSubBasin
// ─────────────────────────────────────────────────────────────

export interface ICreateSubBasinCommand {
    name: string;
    code: string;
    basinId: string;
    description?: string;
}

export class CreateSubBasinCommand {
    constructor(private readonly parameters: ICreateSubBasinCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get code(): string {
        return this.parameters.code;
    }

    get basinId(): string {
        return this.parameters.basinId;
    }

    get description(): string | undefined {
        return this.parameters.description;
    }
}

@CommandHandler(CreateSubBasinCommand)
export class CreateSubBasinHandler implements ICommandHandler<CreateSubBasinCommand, CreateSubBasinResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly subBasinRepository: ISubBasinRepository,
        private readonly basinRepository: IBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateSubBasinCommand): Promise<CreateSubBasinResult> {
        this.logger.log({ msg: 'Creating sub-basin', entity: 'SubBasins', name: command.name });

        // 1. Build entity and validate invariants
        const subBasin = new SubBasin({
            name: command.name,
            code: command.code,
            basinId: command.basinId,
            description: command.description ?? null,
        });
        subBasin.validate();

        // 2. Check basinId exists
        try {
            await this.basinRepository.findById(command.basinId);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Basin with id "${command.basinId}" not found`);
            }
            throw error;
        }

        // 3. Check duplicate code
        const existingByCode = await this.subBasinRepository.findByCode(subBasin.code);
        if (existingByCode) {
            throw new ApiError(HttpStatus.CONFLICT, `Sub-basin with code "${subBasin.code}" already exists`);
        }

        // 4. Check duplicate name+basinId combo
        const existingByNameAndBasin = await this.subBasinRepository.findByNameAndBasinId(
            subBasin.name,
            subBasin.basinId,
        );
        if (existingByNameAndBasin) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                `Sub-basin with name "${subBasin.name}" already exists in basin "${command.basinId}"`,
            );
        }

        // 5. Persist sub-basin
        const persistedSubBasin = await this.subBasinRepository.create(subBasin);

        this.logger.log({
            msg: 'Sub-basin created',
            entity: 'SubBasins',
            id: persistedSubBasin.id,
            name: persistedSubBasin.name,
        });

        await this.cacheService.delByPattern(SubBasinCacheKeys.pattern());

        return new CreateSubBasinResult({
            id: persistedSubBasin.id,
            name: persistedSubBasin.name,
            code: persistedSubBasin.code,
            basinId: persistedSubBasin.basinId,
            basinName: persistedSubBasin.basinName,
            description: persistedSubBasin.description,
            area: persistedSubBasin.area,
            perimetro: persistedSubBasin.perimetro,
            centroidX: persistedSubBasin.centroidX,
            centroidY: persistedSubBasin.centroidY,
            isActive: persistedSubBasin.isActive,
            createdAt: persistedSubBasin.createdAt!,
            updatedAt: persistedSubBasin.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateSubBasin
// ─────────────────────────────────────────────────────────────

export interface IUpdateSubBasinCommand {
    id: string;
    name?: string;
    code?: string;
    description?: string | null;
}

export class UpdateSubBasinCommand {
    constructor(private readonly parameters: IUpdateSubBasinCommand) {}
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

@CommandHandler(UpdateSubBasinCommand)
export class UpdateSubBasinHandler implements ICommandHandler<UpdateSubBasinCommand, UpdateSubBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly subBasinRepository: ISubBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateSubBasinCommand): Promise<UpdateSubBasinResult> {
        this.logger.log({ msg: 'Updating sub-basin', entity: 'SubBasins', id: command.id });

        let subBasin;
        try {
            subBasin = await this.subBasinRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Sub-basin with id "${command.id}" not found`);
            }
            throw error;
        }

        if (command.name !== undefined) subBasin.name = command.name;
        if (command.code !== undefined) subBasin.code = command.code;
        if (command.description !== undefined) subBasin.description = command.description;

        subBasin.validate();

        if (command.code !== undefined) {
            const existingByCode = await this.subBasinRepository.findByCode(subBasin.code);
            if (existingByCode && existingByCode.id !== subBasin.id) {
                throw new ApiError(HttpStatus.CONFLICT, `Sub-basin with code "${subBasin.code}" already exists`);
            }
        }

        if (command.name !== undefined) {
            const existingByNameAndBasin = await this.subBasinRepository.findByNameAndBasinId(
                subBasin.name,
                subBasin.basinId,
            );
            if (existingByNameAndBasin && existingByNameAndBasin.id !== subBasin.id) {
                throw new ApiError(
                    HttpStatus.CONFLICT,
                    `Sub-basin with name "${subBasin.name}" already exists in this basin`,
                );
            }
        }

        const updatedSubBasin = await this.subBasinRepository.update(subBasin);

        this.logger.log({ msg: 'Sub-basin updated', entity: 'SubBasins', id: updatedSubBasin.id });
        await this.cacheService.del(SubBasinCacheKeys.byId(updatedSubBasin.id));
        await this.cacheService.delByPattern(SubBasinCacheKeys.pattern());

        return new UpdateSubBasinResult({
            id: updatedSubBasin.id,
            name: updatedSubBasin.name,
            code: updatedSubBasin.code,
            basinId: updatedSubBasin.basinId,
            basinName: updatedSubBasin.basinName,
            description: updatedSubBasin.description,
            area: updatedSubBasin.area,
            perimetro: updatedSubBasin.perimetro,
            centroidX: updatedSubBasin.centroidX,
            centroidY: updatedSubBasin.centroidY,
            isActive: updatedSubBasin.isActive,
            createdAt: updatedSubBasin.createdAt!,
            updatedAt: updatedSubBasin.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleSubBasin
// ─────────────────────────────────────────────────────────────

export interface IToggleSubBasinCommand {
    id: string;
}

export class ToggleSubBasinCommand {
    constructor(private readonly parameters: IToggleSubBasinCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(ToggleSubBasinCommand)
export class ToggleSubBasinHandler implements ICommandHandler<ToggleSubBasinCommand, ToggleSubBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly subBasinRepository: ISubBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ToggleSubBasinCommand): Promise<ToggleSubBasinResult> {
        this.logger.log({ msg: 'Toggling sub-basin', entity: 'SubBasins', id: command.id });

        let subBasin;
        try {
            subBasin = await this.subBasinRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Sub-basin with id "${command.id}" not found`);
            }
            throw error;
        }

        subBasin.toggleActive();
        const updatedSubBasin = await this.subBasinRepository.update(subBasin);

        this.logger.log({
            msg: 'Sub-basin toggled',
            entity: 'SubBasins',
            id: updatedSubBasin.id,
            isActive: updatedSubBasin.isActive,
        });
        await this.cacheService.del(SubBasinCacheKeys.byId(updatedSubBasin.id));
        await this.cacheService.delByPattern(SubBasinCacheKeys.pattern());

        return new ToggleSubBasinResult({
            id: updatedSubBasin.id,
            name: updatedSubBasin.name,
            code: updatedSubBasin.code,
            isActive: updatedSubBasin.isActive,
            updatedAt: updatedSubBasin.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteSubBasin (soft delete — set isActive=false, idempotent)
// ─────────────────────────────────────────────────────────────

export interface IDeleteSubBasinCommand {
    id: string;
}

export class DeleteSubBasinCommand {
    constructor(private readonly parameters: IDeleteSubBasinCommand) {}
    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteSubBasinCommand)
export class DeleteSubBasinHandler implements ICommandHandler<DeleteSubBasinCommand, DeleteSubBasinResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly subBasinRepository: ISubBasinRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteSubBasinCommand): Promise<DeleteSubBasinResult> {
        this.logger.log({ msg: 'Deleting sub-basin', entity: 'SubBasins', id: command.id });

        let subBasin;
        try {
            subBasin = await this.subBasinRepository.findById(command.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Sub-basin with id "${command.id}" not found`);
            }
            throw error;
        }

        subBasin.isActive = false;
        const updatedSubBasin = await this.subBasinRepository.update(subBasin);

        this.logger.log({
            msg: 'Sub-basin deleted (soft)',
            entity: 'SubBasins',
            id: updatedSubBasin.id,
            isActive: updatedSubBasin.isActive,
        });
        await this.cacheService.del(SubBasinCacheKeys.byId(updatedSubBasin.id));
        await this.cacheService.delByPattern(SubBasinCacheKeys.pattern());

        return new DeleteSubBasinResult({
            id: updatedSubBasin.id,
            name: updatedSubBasin.name,
            code: updatedSubBasin.code,
            isActive: updatedSubBasin.isActive,
            updatedAt: updatedSubBasin.updatedAt!,
        });
    }
}
