import { HttpStatus, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { IProviderConfigRepository } from '@domain/ports/provider-config-repository.port';
import { ProviderConfigResult } from '@domain/results/provider-config.result';
import { ApiError } from '@domain/errors/api.error';
import { ICacheService } from '@domain/ports/cache-service.port';
import { ProviderConfigCacheKeys } from '@infrastructure/cache/cache-config.registry';
import { ProviderSchedulerService } from '@infrastructure/services/provider-scheduler.service';

// ─────────────────────────────────────────────────────────────
// CreateProviderConfig
// ─────────────────────────────────────────────────────────────

export interface ICreateProviderConfigCommand {
    name: string;
    type: string;
    baseUrl: string;
    pollingIntervalMinutes: number;
    settings?: Record<string, unknown>;
}

export class CreateProviderConfigCommand {
    constructor(private readonly parameters: ICreateProviderConfigCommand) {}

    get name(): string {
        return this.parameters.name;
    }

    get type(): string {
        return this.parameters.type;
    }

    get baseUrl(): string {
        return this.parameters.baseUrl;
    }

    get pollingIntervalMinutes(): number {
        return this.parameters.pollingIntervalMinutes;
    }

    get settings(): Record<string, unknown> | undefined {
        return this.parameters.settings;
    }
}

@CommandHandler(CreateProviderConfigCommand)
export class CreateProviderConfigHandler implements ICommandHandler<CreateProviderConfigCommand, ProviderConfigResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateProviderConfigCommand): Promise<ProviderConfigResult> {
        this.logger.log(`Creating provider config: ${command.name}`);

        // 1. Build entity and validate invariants
        const providerConfig = new ProviderConfig({
            name: command.name,
            type: command.type,
            baseUrl: command.baseUrl,
            pollingIntervalMinutes: command.pollingIntervalMinutes,
            settings: command.settings ?? {},
        });
        providerConfig.validate();

        // 2. Check if provider config with same name already exists
        const existing = await this.providerConfigRepository.findByName(providerConfig.name);
        if (existing) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                `Provider config with name "${providerConfig.name}" already exists`,
            );
        }

        // 3. Persist
        const persisted = await this.providerConfigRepository.create(providerConfig);

        this.logger.log({ msg: 'Provider config created', entity: 'ProviderConfig', id: persisted.id });

        await this.cacheService.delByPattern(ProviderConfigCacheKeys.pattern());

        return new ProviderConfigResult({
            id: persisted.id,
            name: persisted.name,
            type: persisted.type,
            baseUrl: persisted.baseUrl,
            pollingIntervalMinutes: persisted.pollingIntervalMinutes,
            isActive: persisted.isActive,
            settings: persisted.settings,
            createdAt: persisted.createdAt!,
            updatedAt: persisted.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateProviderConfig
// ─────────────────────────────────────────────────────────────

export interface IUpdateProviderConfigCommand {
    id: string;
    name?: string;
    type?: string;
    baseUrl?: string;
    pollingIntervalMinutes?: number;
    settings?: Record<string, unknown>;
}

export class UpdateProviderConfigCommand {
    constructor(private readonly parameters: IUpdateProviderConfigCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get name(): string | undefined {
        return this.parameters.name;
    }

    get type(): string | undefined {
        return this.parameters.type;
    }

    get baseUrl(): string | undefined {
        return this.parameters.baseUrl;
    }

    get pollingIntervalMinutes(): number | undefined {
        return this.parameters.pollingIntervalMinutes;
    }

    get settings(): Record<string, unknown> | undefined {
        return this.parameters.settings;
    }
}

@CommandHandler(UpdateProviderConfigCommand)
export class UpdateProviderConfigHandler implements ICommandHandler<UpdateProviderConfigCommand, ProviderConfigResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateProviderConfigCommand): Promise<ProviderConfigResult> {
        this.logger.log(`Updating provider config: ${command.id}`);

        // 1. Find existing provider config
        const existing = await this.providerConfigRepository.findById(command.id);
        if (!existing) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Provider config with id "${command.id}" not found`);
        }

        // 2. Apply updates
        if (command.name !== undefined) existing.name = command.name;
        if (command.type !== undefined) existing.type = command.type;
        if (command.baseUrl !== undefined) existing.baseUrl = command.baseUrl;
        if (command.pollingIntervalMinutes !== undefined)
            existing.pollingIntervalMinutes = command.pollingIntervalMinutes;
        if (command.settings !== undefined) existing.settings = command.settings;

        // 3. Validate
        existing.validate();

        // 4. Check name conflict (if name changed)
        if (command.name !== undefined) {
            const conflict = await this.providerConfigRepository.findByName(existing.name);
            if (conflict && conflict.id !== existing.id) {
                throw new ApiError(HttpStatus.CONFLICT, `Provider config with name "${existing.name}" already exists`);
            }
        }

        // 5. Persist
        const updated = await this.providerConfigRepository.update(existing);

        this.logger.log({ msg: 'Provider config updated', entity: 'ProviderConfig', id: updated.id });

        await this.cacheService.del(ProviderConfigCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(ProviderConfigCacheKeys.pattern());

        return new ProviderConfigResult({
            id: updated.id,
            name: updated.name,
            type: updated.type,
            baseUrl: updated.baseUrl,
            pollingIntervalMinutes: updated.pollingIntervalMinutes,
            isActive: updated.isActive,
            settings: updated.settings,
            createdAt: updated.createdAt!,
            updatedAt: updated.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteProviderConfig
// ─────────────────────────────────────────────────────────────

export interface IDeleteProviderConfigCommand {
    id: string;
}

export class DeleteProviderConfigCommand {
    constructor(private readonly parameters: IDeleteProviderConfigCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

export interface DeleteProviderConfigResult {
    message: string;
}

@CommandHandler(DeleteProviderConfigCommand)
export class DeleteProviderConfigHandler implements ICommandHandler<
    DeleteProviderConfigCommand,
    DeleteProviderConfigResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly cacheService: ICacheService,
        private readonly providerSchedulerService: ProviderSchedulerService,
    ) {}

    async execute(command: DeleteProviderConfigCommand): Promise<DeleteProviderConfigResult> {
        this.logger.log(`Deleting provider config: ${command.id}`);

        // 1. Find existing provider config
        const existing = await this.providerConfigRepository.findById(command.id);
        if (!existing) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Provider config with id "${command.id}" not found`);
        }

        // 2. Remove scheduled job before deleting
        this.providerSchedulerService.removeJob(command.id);

        // 3. Delete
        await this.providerConfigRepository.delete(command.id);

        this.logger.log({ msg: 'Provider config deleted', entity: 'ProviderConfig', id: command.id });

        await this.cacheService.del(ProviderConfigCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(ProviderConfigCacheKeys.pattern());

        return { message: 'Provider config deleted successfully' };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleProviderConfig
// ─────────────────────────────────────────────────────────────

export interface IToggleProviderConfigCommand {
    id: string;
}

export class ToggleProviderConfigCommand {
    constructor(private readonly parameters: IToggleProviderConfigCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(ToggleProviderConfigCommand)
export class ToggleProviderConfigHandler implements ICommandHandler<ToggleProviderConfigCommand, ProviderConfigResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
        private readonly cacheService: ICacheService,
        private readonly providerSchedulerService: ProviderSchedulerService,
    ) {}

    async execute(command: ToggleProviderConfigCommand): Promise<ProviderConfigResult> {
        this.logger.log(`Toggling provider config: ${command.id}`);

        // 1. Find existing provider config
        const existing = await this.providerConfigRepository.findById(command.id);
        if (!existing) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Provider config with id "${command.id}" not found`);
        }

        // 2. Flip isActive
        existing.isActive = !existing.isActive;

        // 3. Persist
        const updated = await this.providerConfigRepository.update(existing);

        this.logger.log({
            msg: 'Provider config toggled',
            entity: 'ProviderConfig',
            id: updated.id,
            isActive: updated.isActive,
        });

        // 4. Register or remove scheduled job
        if (updated.isActive) {
            this.providerSchedulerService.registerJob(updated);
        } else {
            this.providerSchedulerService.removeJob(updated.id);
        }

        await this.cacheService.del(ProviderConfigCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(ProviderConfigCacheKeys.pattern());

        return new ProviderConfigResult({
            id: updated.id,
            name: updated.name,
            type: updated.type,
            baseUrl: updated.baseUrl,
            pollingIntervalMinutes: updated.pollingIntervalMinutes,
            isActive: updated.isActive,
            settings: updated.settings,
            createdAt: updated.createdAt!,
            updatedAt: updated.updatedAt!,
        });
    }
}
