import { StationThresholdData } from '@domain/types/station-threshold-data.type';

// ─────────────────────────────────────────────────────────────
// CreateSubBasin
// ─────────────────────────────────────────────────────────────

export class CreateSubBasinResult {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly basinId: string;
    readonly basinName: string | null;
    readonly description: string | null;
    readonly area: number | null;
    readonly perimetro: number | null;
    readonly centroidX: number | null;
    readonly centroidY: number | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(params: {
        id: string;
        name: string;
        code: string;
        basinId: string;
        basinName: string | null;
        description: string | null;
        area: number | null;
        perimetro: number | null;
        centroidX: number | null;
        centroidY: number | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.basinId = params.basinId;
        this.basinName = params.basinName;
        this.description = params.description;
        this.area = params.area;
        this.perimetro = params.perimetro;
        this.centroidX = params.centroidX;
        this.centroidY = params.centroidY;
        this.isActive = params.isActive;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// GetSubBasin (with stations)
// ─────────────────────────────────────────────────────────────

export class GetSubBasinStationItem {
    readonly id: string;
    readonly name: string;
    readonly subBasinName: string;
    readonly stationCode: string;
    readonly stationType: string;
    readonly threshold: StationThresholdData | null;
    readonly isActive: boolean;

    constructor(params: {
        id: string;
        name: string;
        subBasinName: string;
        stationCode: string;
        stationType: string;
        threshold: StationThresholdData | null;
        isActive: boolean;
    }) {
        this.id = params.id;
        this.name = params.name;
        this.subBasinName = params.subBasinName;
        this.stationCode = params.stationCode;
        this.stationType = params.stationType;
        this.threshold = params.threshold;
        this.isActive = params.isActive;
    }
}

export class GetSubBasinResult {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly basinId: string;
    readonly basinName: string | null;
    readonly description: string | null;
    readonly area: number | null;
    readonly perimetro: number | null;
    readonly centroidX: number | null;
    readonly centroidY: number | null;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly stations: GetSubBasinStationItem[];

    constructor(params: {
        id: string;
        name: string;
        code: string;
        basinId: string;
        basinName: string | null;
        description: string | null;
        area: number | null;
        perimetro: number | null;
        centroidX: number | null;
        centroidY: number | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        stations: GetSubBasinStationItem[];
    }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.basinId = params.basinId;
        this.basinName = params.basinName;
        this.description = params.description;
        this.area = params.area;
        this.perimetro = params.perimetro;
        this.centroidX = params.centroidX;
        this.centroidY = params.centroidY;
        this.isActive = params.isActive;
        this.createdAt = params.createdAt;
        this.updatedAt = params.updatedAt;
        this.stations = params.stations;
    }
}

// ─────────────────────────────────────────────────────────────
// ListSubBasins
// ─────────────────────────────────────────────────────────────

export class ListSubBasinsResult {
    readonly items: CreateSubBasinResult[];
    readonly total: number;

    constructor(params: { items: CreateSubBasinResult[]; total: number }) {
        this.items = params.items;
        this.total = params.total;
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateSubBasin (same shape as CreateSubBasinResult)
// ─────────────────────────────────────────────────────────────

export class UpdateSubBasinResult extends CreateSubBasinResult {}

// ─────────────────────────────────────────────────────────────
// ToggleSubBasin
// ─────────────────────────────────────────────────────────────

export class ToggleSubBasinResult {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly isActive: boolean;
    readonly updatedAt: Date;

    constructor(params: { id: string; name: string; code: string; isActive: boolean; updatedAt: Date }) {
        this.id = params.id;
        this.name = params.name;
        this.code = params.code;
        this.isActive = params.isActive;
        this.updatedAt = params.updatedAt;
    }
}

// ─────────────────────────────────────────────────────────────
// DeleteSubBasin (same as ToggleSubBasin — returns deactivated sub-basin)
// ─────────────────────────────────────────────────────────────

export class DeleteSubBasinResult extends ToggleSubBasinResult {}
