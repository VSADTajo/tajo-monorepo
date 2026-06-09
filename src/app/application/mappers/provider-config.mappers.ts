import {
    CreateProviderConfigRequestDto,
    UpdateProviderConfigRequestDto,
    ProviderConfigResponseDto,
    ListProviderConfigsResponseDto,
    DeleteProviderConfigResponseDto,
    TriggerIngestionResponseDto,
} from '@api/dtos/provider-config.dtos';
import {
    CreateProviderConfigCommand,
    UpdateProviderConfigCommand,
    DeleteProviderConfigCommand,
    ToggleProviderConfigCommand,
} from '@application/commands/provider-config.commands';
import { TriggerIngestionCommand } from '@application/commands/ingestion.commands';
import { ProviderConfigResult } from '@domain/results/provider-config.result';
import { IngestionRunResult } from '@domain/results/ingestion-run.result';

// ─────────────────────────────────────────────────────────────
// CreateProviderConfig
// ─────────────────────────────────────────────────────────────

export class CreateProviderConfigMapper {
    static toCommand(dto: CreateProviderConfigRequestDto): CreateProviderConfigCommand {
        return new CreateProviderConfigCommand(dto);
    }

    static toResponseDto(result: ProviderConfigResult): ProviderConfigResponseDto {
        return {
            id: result.id,
            name: result.name,
            type: result.type,
            baseUrl: result.baseUrl,
            pollingIntervalMinutes: result.pollingIntervalMinutes,
            isActive: result.isActive,
            settings: result.settings,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateProviderConfig
// ─────────────────────────────────────────────────────────────

export class UpdateProviderConfigMapper {
    static toCommand(id: string, dto: UpdateProviderConfigRequestDto): UpdateProviderConfigCommand {
        return new UpdateProviderConfigCommand({ id, ...dto });
    }

    static toResponseDto(result: ProviderConfigResult): ProviderConfigResponseDto {
        return {
            id: result.id,
            name: result.name,
            type: result.type,
            baseUrl: result.baseUrl,
            pollingIntervalMinutes: result.pollingIntervalMinutes,
            isActive: result.isActive,
            settings: result.settings,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteProviderConfig
// ─────────────────────────────────────────────────────────────

export class DeleteProviderConfigMapper {
    static toCommand(id: string): DeleteProviderConfigCommand {
        return new DeleteProviderConfigCommand({ id });
    }

    static toResponseDto(): DeleteProviderConfigResponseDto {
        return { message: 'Provider config deleted successfully' };
    }
}

// ─────────────────────────────────────────────────────────────
// ToggleProviderConfig
// ─────────────────────────────────────────────────────────────

export class ToggleProviderConfigMapper {
    static toCommand(id: string): ToggleProviderConfigCommand {
        return new ToggleProviderConfigCommand({ id });
    }

    static toResponseDto(result: ProviderConfigResult): ProviderConfigResponseDto {
        return {
            id: result.id,
            name: result.name,
            type: result.type,
            baseUrl: result.baseUrl,
            pollingIntervalMinutes: result.pollingIntervalMinutes,
            isActive: result.isActive,
            settings: result.settings,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// ListProviderConfigs
// ─────────────────────────────────────────────────────────────

export class ListProviderConfigsMapper {
    static toResponseDto(results: ProviderConfigResult[]): ListProviderConfigsResponseDto {
        return {
            providerConfigs: results.map((result) => ({
                id: result.id,
                name: result.name,
                type: result.type,
                baseUrl: result.baseUrl,
                pollingIntervalMinutes: result.pollingIntervalMinutes,
                isActive: result.isActive,
                settings: result.settings,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
            })),
        };
    }
}

// ─────────────────────────────────────────────────────────────
// GetProviderConfigById
// ─────────────────────────────────────────────────────────────

export class GetProviderConfigByIdMapper {
    static toResponseDto(result: ProviderConfigResult): ProviderConfigResponseDto {
        return {
            id: result.id,
            name: result.name,
            type: result.type,
            baseUrl: result.baseUrl,
            pollingIntervalMinutes: result.pollingIntervalMinutes,
            isActive: result.isActive,
            settings: result.settings,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// TriggerIngestion
// ─────────────────────────────────────────────────────────────

export class TriggerIngestionMapper {
    static toCommand(providerConfigId: string): TriggerIngestionCommand {
        return new TriggerIngestionCommand({ providerConfigId });
    }

    static toResponseDto(result: IngestionRunResult): TriggerIngestionResponseDto {
        return {
            id: result.id,
            providerConfigId: result.providerConfigId,
            status: result.status,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            seriesCount: result.seriesCount,
            eventsCount: result.eventsCount,
            errorMessage: result.errorMessage,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
        };
    }
}
