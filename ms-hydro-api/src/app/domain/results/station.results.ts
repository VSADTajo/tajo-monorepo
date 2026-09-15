import { StationThresholdData } from '@domain/types/station-threshold-data.type';

// ─────────────────────────────────────────────────────────────
// CreateStation
// ─────────────────────────────────────────────────────────────

export class CreateStationResult {
    readonly id: string;
    readonly name: string;
    readonly subBasinName: string;
    readonly stationCode: string;
    readonly stationType: string;
    readonly subBasinId: string;
    readonly threshold: StationThresholdData | null;
    readonly latitude: number | null;
    readonly longitude: number | null;
    readonly altitude: number | null;
    readonly municipio: string | null;
    readonly provincia: string | null;
    readonly ccaa: string | null;
    readonly tipoCod: string | null;
    readonly zona: string | null;
    readonly zonaExplOgcFid: number | null;
    readonly zonaExplNombre: string | null;
    readonly comarcaName: string | null;
    readonly sistemaName: string | null;
    readonly meteoalertaZonaCode: string | null;
    readonly meteoalertaZonaNombre: string | null;
    readonly hasCaudalNam: boolean;
    readonly hasCaudalMike: boolean;
    readonly description: string | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        name: string;
        subBasinName: string;
        stationCode: string;
        stationType: string;
        subBasinId: string;
        threshold: StationThresholdData | null;
        latitude: number | null;
        longitude: number | null;
        altitude: number | null;
        municipio: string | null;
        provincia: string | null;
        ccaa: string | null;
        tipoCod: string | null;
        zona: string | null;
        zonaExplOgcFid: number | null;
        zonaExplNombre: string | null;
        comarcaName: string | null;
        sistemaName: string | null;
        meteoalertaZonaCode: string | null;
        meteoalertaZonaNombre: string | null;
        hasCaudalNam: boolean;
        hasCaudalMike: boolean;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.name = params.name;
        this.subBasinName = params.subBasinName;
        this.stationCode = params.stationCode;
        this.stationType = params.stationType;
        this.subBasinId = params.subBasinId;
        this.threshold = params.threshold;
        this.latitude = params.latitude;
        this.longitude = params.longitude;
        this.altitude = params.altitude;
        this.municipio = params.municipio;
        this.provincia = params.provincia;
        this.ccaa = params.ccaa;
        this.tipoCod = params.tipoCod;
        this.zona = params.zona;
        this.zonaExplOgcFid = params.zonaExplOgcFid;
        this.zonaExplNombre = params.zonaExplNombre;
        this.comarcaName = params.comarcaName;
        this.sistemaName = params.sistemaName;
        this.meteoalertaZonaCode = params.meteoalertaZonaCode;
        this.meteoalertaZonaNombre = params.meteoalertaZonaNombre;
        this.hasCaudalNam = params.hasCaudalNam;
        this.hasCaudalMike = params.hasCaudalMike;
        this.description = params.description;
        this.isActive = params.isActive;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// GetStation (same shape as CreateStationResult)
// ─────────────────────────────────────────────────────────────

export class GetStationResult extends CreateStationResult {}

// ─────────────────────────────────────────────────────────────
// GetStationBySubBasinName (same shape as CreateStationResult)
// ─────────────────────────────────────────────────────────────

export class GetStationBySubBasinNameResult extends CreateStationResult {}

// ─────────────────────────────────────────────────────────────
// ListStations
// ─────────────────────────────────────────────────────────────

export class ListStationsResult {
    readonly items: CreateStationResult[];
    readonly total: number;

    constructor(params: { items: CreateStationResult[]; total: number }) {
        this.items = params.items;
        this.total = params.total;
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateStation (same shape as CreateStationResult)
// ─────────────────────────────────────────────────────────────

export class UpdateStationResult extends CreateStationResult {}

// ─────────────────────────────────────────────────────────────
// ToggleStation
// ─────────────────────────────────────────────────────────────

export class ToggleStationResult {
    readonly id: string;
    readonly name: string;
    readonly stationCode: string;
    readonly isActive: boolean;
    readonly updatedAt: Date;

    constructor(params: { id: string; name: string; stationCode: string; isActive: boolean; updatedAt: Date }) {
        this.id = params.id;
        this.name = params.name;
        this.stationCode = params.stationCode;
        this.isActive = params.isActive;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteStation (same as ToggleStation — returns deactivated station)
// ─────────────────────────────────────────────────────────────

export class DeleteStationResult extends ToggleStationResult {}

// ─────────────────────────────────────────────────────────────
// UpdateThreshold
// ─────────────────────────────────────────────────────────────

export class UpdateThresholdResult {
    readonly id: string;
    readonly stationId: string;
    readonly stationCode: string;
    readonly threshold: StationThresholdData;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        stationId: string;
        stationCode: string;
        threshold: StationThresholdData;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.stationId = params.stationId;
        this.stationCode = params.stationCode;
        this.threshold = params.threshold;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// GetThreshold
// ─────────────────────────────────────────────────────────────

export class GetThresholdResult {
    readonly stationId: string;
    readonly stationCode: string;
    readonly threshold: StationThresholdData | null;

    constructor(params: { stationId: string; stationCode: string; threshold: StationThresholdData | null }) {
        this.stationId = params.stationId;
        this.stationCode = params.stationCode;
        this.threshold = params.threshold;
    }
}
