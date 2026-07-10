import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IPredictionTypeRepository } from '@domain/ports/prediction-type-repository.port';
import { IPredictionRepository } from '@domain/ports/prediction-repository.port';
import { IStationCatalogService } from '@domain/ports/station-catalog-service.port';
import {
    ListPredictionTypesResult,
    StationTypeCoverageResult,
    CoverageMatrixResult,
    ICoverageMatrixStation,
} from '@domain/results/prediction-type.result';

// ─────────────────────────────────────────────────────────────
// ListPredictionTypes
// ─────────────────────────────────────────────────────────────

export class ListPredictionTypesQuery {}

@QueryHandler(ListPredictionTypesQuery)
export class ListPredictionTypesHandler implements IQueryHandler<ListPredictionTypesQuery, ListPredictionTypesResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionTypeRepository: IPredictionTypeRepository,
    ) {}

    async execute(): Promise<ListPredictionTypesResult> {
        this.logger.debug('Listing all prediction types');

        const predictionTypes = await this.predictionTypeRepository.findAll();

        return new ListPredictionTypesResult(
            predictionTypes.map((pt) => ({
                id: pt.id,
                name: pt.name,
                unit: pt.unit,
            })),
        );
    }
}

// ─────────────────────────────────────────────────────────────
// ListStationPredictionTypes — coverage of ALL catalog types for one station
// ─────────────────────────────────────────────────────────────

export class ListStationPredictionTypesQuery {
    constructor(public readonly stationCode: string) {}
}

@QueryHandler(ListStationPredictionTypesQuery)
export class ListStationPredictionTypesHandler implements IQueryHandler<
    ListStationPredictionTypesQuery,
    StationTypeCoverageResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: ListStationPredictionTypesQuery): Promise<StationTypeCoverageResult> {
        this.logger.debug(`Building prediction type coverage for station ${query.stationCode}`);

        const types = await this.predictionRepository.findTypeCoverageByStation(query.stationCode);

        return new StationTypeCoverageResult({
            stationCode: query.stationCode,
            types: types.map((t) => ({ id: t.id, name: t.name, unit: t.unit, lastEntered: t.lastEntered })),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetTypeCoverageMatrix — all stations × all types
// ─────────────────────────────────────────────────────────────

export class GetTypeCoverageMatrixQuery {}

@QueryHandler(GetTypeCoverageMatrixQuery)
export class GetTypeCoverageMatrixHandler implements IQueryHandler<GetTypeCoverageMatrixQuery, CoverageMatrixResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly predictionRepository: IPredictionRepository,
        private readonly predictionTypeRepository: IPredictionTypeRepository,
        private readonly stationCatalog: IStationCatalogService,
    ) {}

    async execute(): Promise<CoverageMatrixResult> {
        this.logger.debug('Building prediction type coverage matrix (all stations × all types)');

        const [typesCatalog, cells, catalogStations] = await Promise.all([
            this.predictionTypeRepository.findAll(),
            this.predictionRepository.findTypeCoverageMatrix(),
            this.stationCatalog.listStations(),
        ]);

        const types = typesCatalog.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));
        const typeIndexById = new Map(types.map((t, index) => [t.id, index]));

        // Index cells by station for O(1) lookup while building rows.
        const cellsByStation = new Map<string, Map<string, string>>();
        for (const cell of cells) {
            let byType = cellsByStation.get(cell.stationId);
            if (!byType) {
                byType = new Map();
                cellsByStation.set(cell.stationId, byType);
            }
            byType.set(cell.predictionTypeId, cell.lastEntered);
        }

        // Union of stations: catalog (hydro) ∪ any station that has data but is not in the catalog.
        const stationNameByCode = new Map<string, string | null>();
        for (const s of catalogStations) stationNameByCode.set(s.code, s.name);
        for (const code of cellsByStation.keys()) {
            if (!stationNameByCode.has(code)) stationNameByCode.set(code, null);
        }

        const stations: ICoverageMatrixStation[] = [...stationNameByCode.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([stationCode, stationName]) => {
                const byType = cellsByStation.get(stationCode);
                const emptyCells: (string | null)[] = new Array(types.length).fill(null);
                let withData = 0;
                if (byType) {
                    for (const [typeId, lastEntered] of byType.entries()) {
                        const index = typeIndexById.get(typeId);
                        if (index !== undefined) {
                            emptyCells[index] = lastEntered;
                            withData += 1;
                        }
                    }
                }
                return { stationCode, stationName, cells: emptyCells, withData };
            });

        return new CoverageMatrixResult({
            generatedAt: new Date().toISOString(),
            types,
            stations,
        });
    }
}
