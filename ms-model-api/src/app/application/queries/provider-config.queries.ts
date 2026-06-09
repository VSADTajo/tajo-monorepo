import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IProviderConfigRepository } from '@domain/ports/provider-config-repository.port';
import { ProviderConfigResult } from '@domain/results/provider-config.result';
import { ApiError } from '@domain/errors/api.error';

// ─────────────────────────────────────────────────────────────
// ListProviderConfigs
// ─────────────────────────────────────────────────────────────

export class ListProviderConfigsQuery {}

@QueryHandler(ListProviderConfigsQuery)
export class ListProviderConfigsHandler implements IQueryHandler<ListProviderConfigsQuery, ProviderConfigResult[]> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
    ) {}

    async execute(): Promise<ProviderConfigResult[]> {
        this.logger.debug('Listing all provider configs');

        const providerConfigs = await this.providerConfigRepository.findAll();

        return providerConfigs.map(
            (pc) =>
                new ProviderConfigResult({
                    id: pc.id,
                    name: pc.name,
                    type: pc.type,
                    baseUrl: pc.baseUrl,
                    pollingIntervalMinutes: pc.pollingIntervalMinutes,
                    isActive: pc.isActive,
                    settings: pc.settings,
                    createdAt: pc.createdAt!,
                    updatedAt: pc.updatedAt!,
                }),
        );
    }
}

// ─────────────────────────────────────────────────────────────
// GetProviderConfigById
// ─────────────────────────────────────────────────────────────

export interface IGetProviderConfigByIdQuery {
    id: string;
}

export class GetProviderConfigByIdQuery {
    constructor(private readonly parameters: IGetProviderConfigByIdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetProviderConfigByIdQuery)
export class GetProviderConfigByIdHandler implements IQueryHandler<GetProviderConfigByIdQuery, ProviderConfigResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly providerConfigRepository: IProviderConfigRepository,
    ) {}

    async execute(query: GetProviderConfigByIdQuery): Promise<ProviderConfigResult> {
        this.logger.debug(`Getting provider config by id: ${query.id}`);

        const providerConfig = await this.providerConfigRepository.findById(query.id);
        if (!providerConfig) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Provider config with id "${query.id}" not found`);
        }

        return new ProviderConfigResult({
            id: providerConfig.id,
            name: providerConfig.name,
            type: providerConfig.type,
            baseUrl: providerConfig.baseUrl,
            pollingIntervalMinutes: providerConfig.pollingIntervalMinutes,
            isActive: providerConfig.isActive,
            settings: providerConfig.settings,
            createdAt: providerConfig.createdAt!,
            updatedAt: providerConfig.updatedAt!,
        });
    }
}
