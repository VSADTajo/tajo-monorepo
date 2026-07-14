import { HttpStatus, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

// Domain
import { IStationRepository } from '@domain/ports/station-repository.port';
import { IStationThresholdRepository } from '@domain/ports/station-threshold-repository.port';
import { IDownstreamStationsRepository } from '@domain/ports/downstream-stations-repository.port';
import {
    CreateStationResult,
    GetStationResult,
    GetStationBySubBasinNameResult,
    GetThresholdResult,
    ListStationsResult,
} from '@domain/results/station.results';
import { DownstreamStationItem, DownstreamStationsResult } from '@domain/results/downstream-stations.result';
import { ApiError } from '@domain/errors/api.error';
import { RepositoryError } from '@domain/errors/repository.error';

// ─────────────────────────────────────────────────────────────
// GetDownstreamStations
// ─────────────────────────────────────────────────────────────

export interface IGetDownstreamStationsQuery {
    codes: string[];
}

export class GetDownstreamStationsQuery {
    constructor(private readonly parameters: IGetDownstreamStationsQuery) {}

    get codes(): string[] {
        return this.parameters.codes;
    }
}

@QueryHandler(GetDownstreamStationsQuery)
export class GetDownstreamStationsHandler implements IQueryHandler<
    GetDownstreamStationsQuery,
    DownstreamStationsResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly downstreamStationsRepository: IDownstreamStationsRepository,
    ) {}

    async execute(query: GetDownstreamStationsQuery): Promise<DownstreamStationsResult> {
        this.logger.debug(`Getting downstream stations for codes: ${query.codes.join(', ')}`);

        const rows = await this.downstreamStationsRepository.findDownstream(query.codes);

        return new DownstreamStationsResult({
            items: rows.map(
                (r) =>
                    new DownstreamStationItem({
                        codigoDestino: r.codigoDestino,
                        nombreDestino: r.nombreDestino,
                        tipoDestino: r.tipoDestino,
                    }),
            ),
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationById
// ─────────────────────────────────────────────────────────────

export interface IGetStationByIdQuery {
    id: string;
}

export class GetStationByIdQuery {
    constructor(private readonly parameters: IGetStationByIdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetStationByIdQuery)
export class GetStationByIdHandler implements IQueryHandler<GetStationByIdQuery, GetStationResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
    ) {}

    async execute(query: GetStationByIdQuery): Promise<GetStationResult> {
        this.logger.debug(`Getting station by id: ${query.id}`);

        let station;
        try {
            station = await this.stationRepository.findById(query.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Station with id "${query.id}" not found`);
            }
            throw error;
        }

        return new GetStationResult({
            id: station.id,
            name: station.name,
            subBasinName: station.subBasinName,
            stationCode: station.stationCode,
            stationType: station.stationType,
            subBasinId: station.subBasinId,
            threshold: station.threshold ?? null,
            latitude: station.latitude,
            longitude: station.longitude,
            altitude: station.altitude,
            municipio: station.municipio,
            provincia: station.provincia,
            ccaa: station.ccaa,
            tipoCod: station.tipoCod,
            zona: station.zona,
            zonaExplOgcFid: station.zonaExplOgcFid,
            zonaExplNombre: station.zonaExplNombre,
            comarcaName: station.comarcaName,
            sistemaName: station.sistemaName,
            meteoalertaZonaCode: station.meteoalertaZonaCode,
            meteoalertaZonaNombre: station.meteoalertaZonaNombre,
            description: station.description,
            isActive: station.isActive,
            createdAt: station.createdAt!,
            updatedAt: station.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationBySubBasinName
// ─────────────────────────────────────────────────────────────

export interface IGetStationBySubBasinNameQuery {
    subBasinName: string;
}

export class GetStationBySubBasinNameQuery {
    constructor(private readonly parameters: IGetStationBySubBasinNameQuery) {}

    get subBasinName(): string {
        return this.parameters.subBasinName;
    }
}

@QueryHandler(GetStationBySubBasinNameQuery)
export class GetStationBySubBasinNameHandler implements IQueryHandler<
    GetStationBySubBasinNameQuery,
    GetStationBySubBasinNameResult
> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
    ) {}

    async execute(query: GetStationBySubBasinNameQuery): Promise<GetStationBySubBasinNameResult> {
        this.logger.debug(`Getting station by subBasinName: ${query.subBasinName}`);

        const station = await this.stationRepository.findBySubBasinName(query.subBasinName);
        if (!station) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Station with subBasinName "${query.subBasinName}" not found`);
        }

        return new GetStationBySubBasinNameResult({
            id: station.id,
            name: station.name,
            subBasinName: station.subBasinName,
            stationCode: station.stationCode,
            stationType: station.stationType,
            subBasinId: station.subBasinId,
            threshold: station.threshold ?? null,
            latitude: station.latitude,
            longitude: station.longitude,
            altitude: station.altitude,
            municipio: station.municipio,
            provincia: station.provincia,
            ccaa: station.ccaa,
            tipoCod: station.tipoCod,
            zona: station.zona,
            zonaExplOgcFid: station.zonaExplOgcFid,
            zonaExplNombre: station.zonaExplNombre,
            comarcaName: station.comarcaName,
            sistemaName: station.sistemaName,
            meteoalertaZonaCode: station.meteoalertaZonaCode,
            meteoalertaZonaNombre: station.meteoalertaZonaNombre,
            description: station.description,
            isActive: station.isActive,
            createdAt: station.createdAt!,
            updatedAt: station.updatedAt!,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationThreshold
// ─────────────────────────────────────────────────────────────

export interface IGetStationThresholdQuery {
    id: string;
}

export class GetStationThresholdQuery {
    constructor(private readonly parameters: IGetStationThresholdQuery) {}

    get id(): string {
        return this.parameters.id;
    }
}

@QueryHandler(GetStationThresholdQuery)
export class GetStationThresholdHandler implements IQueryHandler<GetStationThresholdQuery, GetThresholdResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
        private readonly stationThresholdRepository: IStationThresholdRepository,
    ) {}

    async execute(query: GetStationThresholdQuery): Promise<GetThresholdResult> {
        this.logger.debug(`Getting threshold for station: ${query.id}`);

        let station;
        try {
            station = await this.stationRepository.findById(query.id);
        } catch (error) {
            if (error instanceof RepositoryError) {
                throw new ApiError(HttpStatus.NOT_FOUND, `Station with id "${query.id}" not found`);
            }
            throw error;
        }

        const threshold = await this.stationThresholdRepository.findByStationId(station.id);

        return new GetThresholdResult({
            stationId: station.id,
            stationCode: station.stationCode,
            threshold,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// ListStations
// ─────────────────────────────────────────────────────────────

export interface IListStationsQuery {
    page?: number;
    limit?: number;
    subBasinId?: string;
    stationType?: string;
    isActive?: boolean;
    zona?: string;
    zonaExplOgcFid?: number;
    zonaExplNombre?: string;
    subBasinName?: string;
    comarcaName?: string;
    sistemaName?: string;
    meteoalertaZonaCode?: string;
    meteoalertaZonaNombre?: string;
    stationCode?: string;
}

export class ListStationsQuery {
    constructor(private readonly parameters: IListStationsQuery) {}

    get page(): number | undefined {
        return this.parameters.page;
    }
    get limit(): number | undefined {
        return this.parameters.limit;
    }
    get subBasinId(): string | undefined {
        return this.parameters.subBasinId;
    }
    get stationType(): string | undefined {
        return this.parameters.stationType;
    }
    get isActive(): boolean | undefined {
        return this.parameters.isActive;
    }
    get zona(): string | undefined {
        return this.parameters.zona;
    }
    get zonaExplOgcFid(): number | undefined {
        return this.parameters.zonaExplOgcFid;
    }
    get zonaExplNombre(): string | undefined {
        return this.parameters.zonaExplNombre;
    }
    get subBasinName(): string | undefined {
        return this.parameters.subBasinName;
    }
    get comarcaName(): string | undefined {
        return this.parameters.comarcaName;
    }
    get sistemaName(): string | undefined {
        return this.parameters.sistemaName;
    }
    get meteoalertaZonaCode(): string | undefined {
        return this.parameters.meteoalertaZonaCode;
    }
    get meteoalertaZonaNombre(): string | undefined {
        return this.parameters.meteoalertaZonaNombre;
    }
    get stationCode(): string | undefined {
        return this.parameters.stationCode;
    }
}

@QueryHandler(ListStationsQuery)
export class ListStationsHandler implements IQueryHandler<ListStationsQuery, ListStationsResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
    ) {}

    async execute(query: ListStationsQuery): Promise<ListStationsResult> {
        this.logger.debug(`Listing stations: page=${query.page}, limit=${query.limit}`);

        const { items, total } = await this.stationRepository.findAll({
            page: query.page,
            limit: query.limit,
            subBasinId: query.subBasinId,
            stationType: query.stationType,
            isActive: query.isActive,
            zona: query.zona,
            zonaExplOgcFid: query.zonaExplOgcFid,
            zonaExplNombre: query.zonaExplNombre,
            subBasinName: query.subBasinName,
            comarcaName: query.comarcaName,
            sistemaName: query.sistemaName,
            meteoalertaZonaCode: query.meteoalertaZonaCode,
            meteoalertaZonaNombre: query.meteoalertaZonaNombre,
            stationCode: query.stationCode,
        });

        return new ListStationsResult({
            items: items.map(
                (station) =>
                    new CreateStationResult({
                        id: station.id,
                        name: station.name,
                        subBasinName: station.subBasinName,
                        stationCode: station.stationCode,
                        stationType: station.stationType,
                        subBasinId: station.subBasinId,
                        threshold: station.threshold ?? null,
                        latitude: station.latitude,
                        longitude: station.longitude,
                        altitude: station.altitude,
                        municipio: station.municipio,
                        provincia: station.provincia,
                        ccaa: station.ccaa,
                        tipoCod: station.tipoCod,
                        zona: station.zona,
                        zonaExplOgcFid: station.zonaExplOgcFid,
                        zonaExplNombre: station.zonaExplNombre,
                        comarcaName: station.comarcaName,
                        sistemaName: station.sistemaName,
                        meteoalertaZonaCode: station.meteoalertaZonaCode,
                        meteoalertaZonaNombre: station.meteoalertaZonaNombre,
                        description: station.description,
                        isActive: station.isActive,
                        createdAt: station.createdAt!,
                        updatedAt: station.updatedAt!,
                    }),
            ),
            total,
        });
    }
}

// ─────────────────────────────────────────────────────────────
// GetStationByCode
// ─────────────────────────────────────────────────────────────

export interface IGetStationByCodeQuery {
    stationCode: string;
}

export class GetStationByCodeQuery {
    constructor(private readonly parameters: IGetStationByCodeQuery) {}

    get stationCode(): string {
        return this.parameters.stationCode;
    }
}

@QueryHandler(GetStationByCodeQuery)
export class GetStationByCodeHandler implements IQueryHandler<GetStationByCodeQuery, GetStationResult> {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly stationRepository: IStationRepository,
    ) {}

    async execute(query: GetStationByCodeQuery): Promise<GetStationResult> {
        this.logger.debug(`Getting station by code: ${query.stationCode}`);

        const station = await this.stationRepository.findByStationCode(query.stationCode);
        if (!station) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Station with code "${query.stationCode}" not found`);
        }

        return new GetStationResult({
            id: station.id,
            name: station.name,
            subBasinName: station.subBasinName,
            stationCode: station.stationCode,
            stationType: station.stationType,
            subBasinId: station.subBasinId,
            threshold: station.threshold ?? null,
            latitude: station.latitude,
            longitude: station.longitude,
            altitude: station.altitude,
            municipio: station.municipio,
            provincia: station.provincia,
            ccaa: station.ccaa,
            tipoCod: station.tipoCod,
            zona: station.zona,
            zonaExplOgcFid: station.zonaExplOgcFid,
            zonaExplNombre: station.zonaExplNombre,
            comarcaName: station.comarcaName,
            sistemaName: station.sistemaName,
            meteoalertaZonaCode: station.meteoalertaZonaCode,
            meteoalertaZonaNombre: station.meteoalertaZonaNombre,
            description: station.description,
            isActive: station.isActive,
            createdAt: station.createdAt!,
            updatedAt: station.updatedAt!,
        });
    }
}
