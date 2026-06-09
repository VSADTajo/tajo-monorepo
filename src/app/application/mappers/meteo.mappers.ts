import { TriggerSource } from '@domain/types/ingest-status.enum';
import { MeteoFilter } from '@domain/types/meteo-filter.type';
import {
    AccumulateResult,
    SyncResult,
    DatasetSyncResult,
    MeteoInfoResult,
    MeteoProviderResult,
} from '@domain/results/meteo.results';
import { AccumulateMeteoCommand, SyncMeteoCommand } from '@application/commands/meteo.commands';
import { MeteoInfoQuery, MeteoProvidersQuery } from '@application/queries/meteo.queries';

// ─────────────────────────────────────────────────────────────
// Response DTO types (defined here to avoid API layer dependency)
// Controllers map these to their HTTP DTOs
// ─────────────────────────────────────────────────────────────

export interface SyncResultResponse {
    triggeredBy: string;
    datasets: DatasetSyncResultResponse[];
}

export interface DatasetSyncResultResponse {
    provider: string;
    variable: string | null;
    status: string;
    filesOk: number;
    filesFailed: number;
    runId: string | null;
}

export interface MeteoInfoResponse {
    provider: string;
    variable: string | null;
    layerName: string;
    info: unknown;
    lastRun: unknown;
}

export interface MeteoProviderResponse {
    provider: string;
    variables: string[];
}

// ─────────────────────────────────────────────────────────────
// SyncMeteo
// ─────────────────────────────────────────────────────────────

export class SyncMeteoMapper {
    static toCommand(filter: MeteoFilter, triggeredBy: TriggerSource): SyncMeteoCommand {
        return new SyncMeteoCommand({
            provider: filter.provider,
            variable: filter.variable,
            triggeredBy,
        });
    }

    static toResponse(result: SyncResult): SyncResultResponse {
        return {
            triggeredBy: result.triggeredBy,
            datasets: result.datasets.map((d) => SyncMeteoMapper.toDatasetResponse(d)),
        };
    }

    private static toDatasetResponse(d: DatasetSyncResult): DatasetSyncResultResponse {
        return {
            provider: d.provider,
            variable: d.variable,
            status: d.status,
            filesOk: d.filesOk,
            filesFailed: d.filesFailed,
            runId: d.runId,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// MeteoInfo
// ─────────────────────────────────────────────────────────────

export class MeteoInfoMapper {
    static toQuery(filter: MeteoFilter): MeteoInfoQuery {
        return new MeteoInfoQuery({ provider: filter.provider, variable: filter.variable });
    }

    static toResponse(result: MeteoInfoResult): MeteoInfoResponse {
        return {
            provider: result.provider,
            variable: result.variable,
            layerName: result.layerName,
            info: result.info,
            lastRun: result.lastRun,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// MeteoProviders
// ─────────────────────────────────────────────────────────────

export class MeteoProvidersMapper {
    static toQuery(): MeteoProvidersQuery {
        return new MeteoProvidersQuery();
    }

    static toResponse(result: MeteoProviderResult): MeteoProviderResponse {
        return { provider: result.provider, variables: result.variables };
    }
}

// ─────────────────────────────────────────────────────────────
// AccumulateMeteo
// ─────────────────────────────────────────────────────────────

export interface AccumulateMeteoResponse {
    provider: string;
    variable: string | null;
    layerName: string;
    from: string;
    to: string;
    filesUsed: number;
}

export class AccumulateMeteoMapper {
    static toCommand(dto: { provider: string; variable?: string; from: string; to: string }): AccumulateMeteoCommand {
        return new AccumulateMeteoCommand({
            provider: dto.provider,
            variable: dto.variable,
            from: dto.from,
            to: dto.to,
        });
    }

    static toResponse(result: AccumulateResult): AccumulateMeteoResponse {
        return {
            provider: result.provider,
            variable: result.variable,
            layerName: result.layerName,
            from: result.from,
            to: result.to,
            filesUsed: result.filesUsed,
        };
    }
}
