import { Inject, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IMappingSchemaRepository } from '@domain/ports/mapping-schema-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { MappingSchema, InputFormat, OutputFormat, ICsvOptions } from '@domain/entities/mapping-schema.entity';
import { IFieldMapping } from '@domain/value-objects/field-mapping.value-object';
import { MappingSchemaResult, DeleteMappingSchemaResult } from '@domain/results/mapping-schema.result';
import { ApiError } from '@domain/errors/api.error';

// Cache
import { MappingSchemaCacheKeys, FileCacheKeys } from '@infrastructure/cache/cache-config.registry';

// ─────────────────────────────────────────────────────────────
// CreateMappingSchema
// ─────────────────────────────────────────────────────────────

export interface ICreateMappingSchemaCommand {
    directoryPath: string;
    name: string;
    inputFormat: InputFormat;
    outputFormat: OutputFormat;
    fieldMappings: IFieldMapping[];
    csvOptions: ICsvOptions | null;
}

export class CreateMappingSchemaCommand {
    constructor(private readonly parameters: ICreateMappingSchemaCommand) {}

    get directoryPath(): string {
        return this.parameters.directoryPath;
    }

    get name(): string {
        return this.parameters.name;
    }

    get inputFormat(): InputFormat {
        return this.parameters.inputFormat;
    }

    get outputFormat(): OutputFormat {
        return this.parameters.outputFormat;
    }

    get fieldMappings(): IFieldMapping[] {
        return this.parameters.fieldMappings;
    }

    get csvOptions(): ICsvOptions | null {
        return this.parameters.csvOptions;
    }
}

@CommandHandler(CreateMappingSchemaCommand)
export class CreateMappingSchemaHandler implements ICommandHandler<CreateMappingSchemaCommand, MappingSchemaResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: CreateMappingSchemaCommand): Promise<MappingSchemaResult> {
        this.logger.log(`Creating mapping schema for path: ${command.directoryPath}`);

        const schema = new MappingSchema({
            directoryPath: command.directoryPath,
            name: command.name,
            inputFormat: command.inputFormat,
            outputFormat: command.outputFormat,
            isActive: true,
            fieldMappings: command.fieldMappings,
            csvOptions: command.csvOptions,
        });
        schema.validate();

        const existing = await this.mappingSchemaRepository.findByDirectoryPath(schema.directoryPath);
        if (existing) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                `A mapping schema already exists for path: ${schema.directoryPath}`,
            );
        }

        const persisted = await this.mappingSchemaRepository.create(schema);

        await this.cacheService.del(MappingSchemaCacheKeys.list());
        await this.cacheService.delByPattern(MappingSchemaCacheKeys.pattern());

        return new MappingSchemaResult(persisted);
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateMappingSchema
// ─────────────────────────────────────────────────────────────

export interface IUpdateMappingSchemaCommand {
    id: string;
    directoryPath?: string;
    name?: string;
    inputFormat?: InputFormat;
    outputFormat?: OutputFormat;
    fieldMappings?: IFieldMapping[];
    csvOptions?: ICsvOptions | null;
}

export class UpdateMappingSchemaCommand {
    constructor(private readonly parameters: IUpdateMappingSchemaCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get directoryPath(): string | undefined {
        return this.parameters.directoryPath;
    }

    get name(): string | undefined {
        return this.parameters.name;
    }

    get inputFormat(): InputFormat | undefined {
        return this.parameters.inputFormat;
    }

    get outputFormat(): OutputFormat | undefined {
        return this.parameters.outputFormat;
    }

    get fieldMappings(): IFieldMapping[] | undefined {
        return this.parameters.fieldMappings;
    }

    get csvOptions(): ICsvOptions | null | undefined {
        return this.parameters.csvOptions;
    }
}

@CommandHandler(UpdateMappingSchemaCommand)
export class UpdateMappingSchemaHandler implements ICommandHandler<UpdateMappingSchemaCommand, MappingSchemaResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: UpdateMappingSchemaCommand): Promise<MappingSchemaResult> {
        this.logger.log(`Updating mapping schema: ${command.id}`);

        const schema = await this.mappingSchemaRepository.findById(command.id);
        if (!schema) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Mapping schema not found: ${command.id}`);
        }

        if (command.directoryPath !== undefined) schema.directoryPath = command.directoryPath;
        if (command.name !== undefined) schema.name = command.name;
        if (command.inputFormat !== undefined) schema.inputFormat = command.inputFormat;
        if (command.outputFormat !== undefined) schema.outputFormat = command.outputFormat;
        if (command.fieldMappings !== undefined) schema.fieldMappings = command.fieldMappings;
        if (command.csvOptions !== undefined) schema.csvOptions = command.csvOptions;

        schema.validate();

        if (command.directoryPath !== undefined) {
            const existing = await this.mappingSchemaRepository.findByDirectoryPath(schema.directoryPath);
            if (existing && existing.id !== schema.id) {
                throw new ApiError(
                    HttpStatus.CONFLICT,
                    `A mapping schema already exists for path: ${schema.directoryPath}`,
                );
            }
        }

        const updated = await this.mappingSchemaRepository.update(schema);

        await this.cacheService.del(MappingSchemaCacheKeys.list());
        await this.cacheService.del(MappingSchemaCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(MappingSchemaCacheKeys.pattern());

        return new MappingSchemaResult(updated);
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteMappingSchema
// ─────────────────────────────────────────────────────────────

export interface IDeleteMappingSchemaCommand {
    id: string;
}

export class DeleteMappingSchemaCommand {
    constructor(private readonly parameters: IDeleteMappingSchemaCommand) {}

    get id(): string {
        return this.parameters.id;
    }
}

@CommandHandler(DeleteMappingSchemaCommand)
export class DeleteMappingSchemaHandler implements ICommandHandler<
    DeleteMappingSchemaCommand,
    DeleteMappingSchemaResult
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: DeleteMappingSchemaCommand): Promise<DeleteMappingSchemaResult> {
        this.logger.log(`Deleting mapping schema: ${command.id}`);

        const schema = await this.mappingSchemaRepository.findById(command.id);
        if (!schema) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Mapping schema not found: ${command.id}`);
        }

        await this.mappingSchemaRepository.delete(command.id);

        await this.cacheService.del(MappingSchemaCacheKeys.list());
        await this.cacheService.del(MappingSchemaCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(MappingSchemaCacheKeys.pattern());

        return new DeleteMappingSchemaResult({
            deletedId: schema.id,
            directoryPath: schema.directoryPath,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleMappingSchema
// ─────────────────────────────────────────────────────────────

export interface IToggleMappingSchemaCommand {
    id: string;
    isActive: boolean;
}

export class ToggleMappingSchemaCommand {
    constructor(private readonly parameters: IToggleMappingSchemaCommand) {}

    get id(): string {
        return this.parameters.id;
    }

    get isActive(): boolean {
        return this.parameters.isActive;
    }
}

@CommandHandler(ToggleMappingSchemaCommand)
export class ToggleMappingSchemaHandler implements ICommandHandler<ToggleMappingSchemaCommand, MappingSchemaResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
        private readonly cacheService: ICacheService,
    ) {}

    async execute(command: ToggleMappingSchemaCommand): Promise<MappingSchemaResult> {
        this.logger.log(`Toggling mapping schema ${command.id} to isActive=${command.isActive}`);

        const schema = await this.mappingSchemaRepository.findById(command.id);
        if (!schema) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Mapping schema not found: ${command.id}`);
        }

        schema.isActive = command.isActive;
        const updated = await this.mappingSchemaRepository.update(schema);

        await this.cacheService.del(MappingSchemaCacheKeys.list());
        await this.cacheService.del(MappingSchemaCacheKeys.byId(command.id));
        await this.cacheService.delByPattern(MappingSchemaCacheKeys.pattern());
        await this.cacheService.del(FileCacheKeys.pathsOverview());

        return new MappingSchemaResult(updated);
    }
}
