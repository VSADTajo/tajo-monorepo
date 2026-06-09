import { Organismo } from '@domain/types/organismo.enum';

// ─────────────────────────────────────────────────────────────
// Resolved resguardo values (edited ?? original)
// ─────────────────────────────────────────────────────────────

export interface ResolvedResguardoEntry {
    minimumVolume: number | null;
    reserveVolume: number | null;
    reserveLevel: number | null;
}

// ─────────────────────────────────────────────────────────────
// Raw resguardo entry (used internally by handlers)
// ─────────────────────────────────────────────────────────────

export interface ResguardoEntryData {
    id: string;
    stationId: string;
    date: string;
    organismo: Organismo;
    originalReserveVolume: number | null;
    originalReserveLevel: number | null;
    originalMinimumVolume: number | null;
    reserveVolume: number | null;
    reserveLevel: number | null;
    minimumVolume: number | null;
}

// ─────────────────────────────────────────────────────────────
// GetResguardosByStation
// ─────────────────────────────────────────────────────────────

export class GetResguardosByStationResult {
    readonly stationCode: string;
    readonly stationName: string;
    readonly entries: Record<string, ResolvedResguardoEntry>;
    readonly total: number;

    constructor(params: {
        stationCode: string;
        stationName: string;
        entries: Record<string, ResolvedResguardoEntry>;
        total: number;
    }) {
        this.stationCode = params.stationCode;
        this.stationName = params.stationName;
        this.entries = params.entries;
        this.total = params.total;
    }
}

// ─────────────────────────────────────────────────────────────
// GetResguardoByDate
// ─────────────────────────────────────────────────────────────

export class GetResguardoByDateResult {
    readonly stationCode: string;
    readonly stationName: string;
    readonly entry: ResolvedResguardoEntry;

    constructor(params: { stationCode: string; stationName: string; entry: ResolvedResguardoEntry }) {
        this.stationCode = params.stationCode;
        this.stationName = params.stationName;
        this.entry = params.entry;
    }
}

// ─────────────────────────────────────────────────────────────
// ImportResguardos
// ─────────────────────────────────────────────────────────────

export class ImportResguardosResult {
    readonly totalImported: number;
    readonly stationsProcessed: number;

    constructor(params: { totalImported: number; stationsProcessed: number }) {
        this.totalImported = params.totalImported;
        this.stationsProcessed = params.stationsProcessed;
    }
}

// ─────────────────────────────────────────────────────────────
// UpdateResguardo
// ─────────────────────────────────────────────────────────────

export class UpdateResguardoResult {
    readonly entry: ResolvedResguardoEntry;

    constructor(params: { entry: ResolvedResguardoEntry }) {
        this.entry = params.entry;
    }
}
