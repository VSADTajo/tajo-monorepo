// Manual simulation flow — everything goes through the API gateway (ms-gateway-api),
// which proxies to ms-predictions-api. The backoffice never hits ms-predictions-api directly.

// ── Meteorological forcing ────────────────────────────────────

export type ModmeteoChoice = 'HARMONIE' | 'EPS' | 'BOTH';

export const MODMETEO_OPTIONS: { value: ModmeteoChoice; label: string }[] = [
    { value: 'HARMONIE', label: 'HARMONIE (Q.NAM.harmonie)' },
    { value: 'EPS', label: 'EPS (Q.NAM.ens)' },
    { value: 'BOTH', label: 'BOTH (harmonie + eps)' },
];

// ── Simulation status lifecycle ───────────────────────────────

export type SimulationStatus = 'CREATED' | 'MODEL_PROCESSING' | 'IN_PROGRESS' | 'FINALIZED' | 'MODEL_FAILED';

/** Terminal states stop the monitoring poll. */
export const TERMINAL_STATUSES: SimulationStatus[] = ['FINALIZED', 'MODEL_FAILED'];

export function isTerminalStatus(status: string): boolean {
    return (TERMINAL_STATUSES as string[]).includes(status);
}

// ── Maneuvers ─────────────────────────────────────────────────

/** A maneuver as returned by the backend (persisted). */
export interface Maneuver {
    id: string;
    reservoirCode: string;
    outputFlowValue: number;
    startDate: string | null; // ISO 8601
    endDate: string | null; // ISO 8601
}

/** A maneuver being edited in the create form (no id yet). */
export interface ManeuverDraft {
    reservoirCode: string;
    outputFlowValue: string; // kept as string while editing; coerced to number on submit
    startDate: string; // '' or 'YYYY-MM-DDTHH:mm'
    endDate: string;
}

/** Inline maneuver payload sent to the backend. */
export interface ManeuverInput {
    reservoirCode: string;
    outputFlowValue: number;
    startDate?: string; // ISO 8601
    endDate?: string; // ISO 8601
}

// ── Create simulation ─────────────────────────────────────────

export interface CreateManualSimulationPayload {
    description?: string;
    modmeteo: ModmeteoChoice;
    maneuvers: ManeuverInput[];
}

/** Response of POST /simulations/manual and GET /simulations/manual/:id. */
export interface ManualSimulation {
    id: string;
    simulationDate: string; // YYYYMMDDHHMMSS
    status: string;
    type: string; // MANUAL
    description: string | null;
    createdBy: string | null;
    modmeteo: string | null;
    maneuvers: Maneuver[];
    createdAt?: string; // ISO 8601
    updatedAt?: string; // ISO 8601
}

// ── List simulations ──────────────────────────────────────────

export interface ManualSimulationListItem {
    id: string;
    simulationDate: string;
    status: string;
    type: string;
    description: string | null;
    maneuverCount: number;
    maneuvers: Maneuver[];
    createdAt?: string;
}

export interface ListManualSimulationsResponse {
    data: ManualSimulationListItem[];
    total: number;
    page: number;
    limit: number;
}

export interface ManualSimulationFilters {
    status?: string;
    stationCode?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'simulationDate' | 'status';
    sortOrder?: 'ASC' | 'DESC';
}

// ── Reservoir option (an EMBALSE_SAIH station) ────────────────

export interface ReservoirOption {
    code: string;
    name: string;
}
