import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { MeteoDiscoveryService } from '@application/services/meteo-discovery.service';
import { IMeteoIngestRunRepository, datasetMapKey } from '@domain/ports/meteo-ingest-run-repository.port';
import { DiscoveredDataset, MeteoInfoResult, MeteoProviderResult } from '@domain/results/meteo.results';

// ─────────────────────────────────────────────────────────────
// MeteoInfo
// ─────────────────────────────────────────────────────────────

export interface IMeteoInfoQuery {
    provider?: string;
    variable?: string;
}

export class MeteoInfoQuery {
    constructor(private readonly parameters: IMeteoInfoQuery) {}
    get provider(): string | undefined {
        return this.parameters.provider;
    }
    get variable(): string | undefined {
        return this.parameters.variable;
    }
}

@QueryHandler(MeteoInfoQuery)
export class MeteoInfoHandler implements IQueryHandler<MeteoInfoQuery, MeteoInfoResult[]> {
    constructor(
        private readonly discovery: MeteoDiscoveryService,
        private readonly runRepository: IMeteoIngestRunRepository,
    ) {}

    async execute(query: MeteoInfoQuery): Promise<MeteoInfoResult[]> {
        const datasets = await this.discovery.discover({
            provider: query.provider,
            variable: query.variable,
        });

        const latestRuns = await this.runRepository.findLatestForAll();

        return datasets.map((dataset) => this.toResult(dataset, latestRuns));
    }

    private toResult(
        dataset: DiscoveredDataset,
        latestRuns: Map<string, ReturnType<typeof datasetMapKey> extends string ? any : never>,
    ): MeteoInfoResult {
        const lastRun = latestRuns.get(datasetMapKey(dataset.provider, dataset.variable)) ?? null;

        return new MeteoInfoResult(
            dataset.provider,
            dataset.variable,
            dataset.layerName.toString(),
            {
                nombre: dataset.info.nombre,
                fechaInicio: dataset.info.fechaInicio.toISOString(),
                fechaFin: dataset.info.fechaFin.toISOString(),
                pasoDeTiempo: dataset.info.pasoDeTiempo,
                unidad: dataset.info.unidad,
                ncols: dataset.info.ncols,
                nrows: dataset.info.nrows,
                bbox: dataset.info.bbox(),
                cellsize: dataset.info.cellsize,
                nodata: dataset.info.noDataValue(),
            },
            lastRun
                ? {
                      startedAt: lastRun.startedAt ? new Date(lastRun.startedAt).toISOString() : null,
                      finishedAt: lastRun.finishedAt ? new Date(lastRun.finishedAt).toISOString() : null,
                      status: lastRun.status,
                      filesOk: lastRun.filesOk,
                      filesFailed: lastRun.filesFailed,
                  }
                : null,
        );
    }
}

// ─────────────────────────────────────────────────────────────
// MeteoProviders
// ─────────────────────────────────────────────────────────────

export class MeteoProvidersQuery {}

@QueryHandler(MeteoProvidersQuery)
export class MeteoProvidersHandler implements IQueryHandler<MeteoProvidersQuery, MeteoProviderResult[]> {
    constructor(private readonly discovery: MeteoDiscoveryService) {}

    async execute(): Promise<MeteoProviderResult[]> {
        const datasets = await this.discovery.discover({});

        const byProvider = new Map<string, Set<string>>();
        for (const dataset of datasets) {
            if (!byProvider.has(dataset.provider)) {
                byProvider.set(dataset.provider, new Set());
            }
            if (dataset.variable !== null) {
                byProvider.get(dataset.provider)!.add(dataset.variable);
            }
        }

        return Array.from(byProvider.entries()).map(
            ([provider, variables]) => new MeteoProviderResult(provider, Array.from(variables)),
        );
    }
}
