import { Inject, HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IMappingSchemaRepository } from '@domain/ports/mapping-schema-repository.port';
import { MappingSchema } from '@domain/entities/mapping-schema.entity';
import { MappingSchemaResult, ListMappingSchemasResult } from '@domain/results/mapping-schema.result';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// ListMappingSchemas
// ─────────────────────────────────────────────────────────────

export class ListMappingSchemasQuery {}

@QueryHandler(ListMappingSchemasQuery)
export class ListMappingSchemasHandler implements IQueryHandler<ListMappingSchemasQuery, ListMappingSchemasResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
    ) {}

    async execute(_query: ListMappingSchemasQuery): Promise<ListMappingSchemasResult> {
        this.logger.debug('Listing all mapping schemas');
        _query;
        const schemas = await this.mappingSchemaRepository.findAll();
        const results = schemas.map((s) => new MappingSchemaResult(s));
        return new ListMappingSchemasResult(results);
    }
}

// ─────────────────────────────────────────────────────────────
// GetMappingSchemaById
// ─────────────────────────────────────────────────────────────

export interface IGetMappingSchemaByIdQuery {
    id: string;
}

export class GetMappingSchemaByIdQuery {
    constructor(private readonly parameters: IGetMappingSchemaByIdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetMappingSchemaByIdQuery)
export class GetMappingSchemaByIdHandler implements IQueryHandler<GetMappingSchemaByIdQuery, MappingSchemaResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
    ) {}

    async execute(query: GetMappingSchemaByIdQuery): Promise<MappingSchemaResult> {
        this.logger.debug(`Getting mapping schema by id: ${query.id}`);

        const schema = await this.mappingSchemaRepository.findById(query.id);
        if (!schema) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Mapping schema not found: ${query.id}`);
        }

        return new MappingSchemaResult(schema);
    }
}

// ─────────────────────────────────────────────────────────────
// GetActiveMappingSchemaByPath
// ─────────────────────────────────────────────────────────────

export interface IGetActiveMappingSchemaByPathQuery {
    filePath: string;
}

export class GetActiveMappingSchemaByPathQuery {
    constructor(private readonly parameters: IGetActiveMappingSchemaByPathQuery) {}

    get filePath(): string {
        return this.parameters.filePath;
    }
}

@QueryHandler(GetActiveMappingSchemaByPathQuery)
export class GetActiveMappingSchemaByPathHandler implements IQueryHandler<
    GetActiveMappingSchemaByPathQuery,
    MappingSchema | null
> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly mappingSchemaRepository: IMappingSchemaRepository,
    ) {}

    async execute(query: GetActiveMappingSchemaByPathQuery): Promise<MappingSchema | null> {
        // Extract directory from full file path (e.g., /data/incoming/file.xml -> /data/incoming)
        const lastSlash = query.filePath.lastIndexOf('/');
        const directoryPath = lastSlash > 0 ? query.filePath.substring(0, lastSlash) : '/';

        this.logger.debug(`Looking up active mapping schema for path: ${directoryPath}`);

        const schema = await this.mappingSchemaRepository.findByDirectoryPath(directoryPath);
        if (!schema || !schema.isActive) {
            return null;
        }

        return schema;
    }
}
