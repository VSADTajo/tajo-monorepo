import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import { listStations } from '../hydro/api';
import type {
    CreateManualSimulationPayload,
    InputSeries,
    SimulationResultsResponse,
    ListManualSimulationsResponse,
    ManualSimulation,
    ManualSimulationFilters,
    ReservoirOption,
} from './types';

// All manual-simulation traffic goes through the API gateway — never hit ms-predictions-api directly.
const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Reservoirs (embalses) — EMBALSE_SAIH stations from the hydro catalog ──
// reservoirCode is a free-form string on the backend, so we constrain the UI to real
// station codes here. That keeps operators from dispatching against a reservoir that
// doesn't exist.

export async function listReservoirs(): Promise<ReservoirOption[]> {
    const { items } = await listStations({ stationType: 'EMBALSE_SAIH', isActive: true });
    return items
        .map((st) => ({ code: st.stationCode, name: st.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Create / dispatch a manual simulation ─────────────────────

export async function createManualSimulation(payload: CreateManualSimulationPayload): Promise<ManualSimulation> {
    const { data } = await gatewayClient.post('/simulations/manual', payload);
    return data as ManualSimulation;
}

// ── List manual simulations ───────────────────────────────────

export async function listManualSimulations(
    filters: ManualSimulationFilters,
    signal?: AbortSignal,
): Promise<ListManualSimulationsResponse> {
    const params: Record<string, string | number> = {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        sortBy: filters.sortBy ?? 'createdAt',
        sortOrder: filters.sortOrder ?? 'DESC',
    };
    if (filters.status) params.status = filters.status;
    if (filters.stationCode) params.stationCode = filters.stationCode;

    const { data } = await gatewayClient.get('/simulations/manual', { params, signal });
    return data as ListManualSimulationsResponse;
}

// ── Single manual simulation (used by the monitoring poll) ────

export async function getManualSimulationById(id: string, signal?: AbortSignal): Promise<ManualSimulation> {
    const { data } = await gatewayClient.get(`/simulations/manual/${id}`, { signal });
    return data as ManualSimulation;
}

// ── Lifecycle actions ─────────────────────────────────────────

export async function finalizeSimulation(id: string): Promise<ManualSimulation> {
    const { data } = await gatewayClient.patch(`/simulations/${id}/finalize`);
    return data as ManualSimulation;
}

export async function deleteSimulation(id: string): Promise<{ id: string; deleted: boolean; deletedManeuvers: number }> {
    const { data } = await gatewayClient.delete(`/simulations/${id}`);
    return data as { id: string; deleted: boolean; deletedManeuvers: number };
}

// ── SFTP files — reuse the generic endpoints already implemented for predictions-data ──
export { listSimulationFiles, downloadSimulationFile } from '../predictions-data/api';

// ── Results of a manual simulation ────────────────────────────

/**
 * Asks for the balance the calculator produced.
 *
 * `withResults` is off by default on purpose: the full series for every
 * reservoir is several megabytes, so the table asks for max/last only and the
 * series is fetched per reservoir when a row is expanded.
 */
export async function getManualSimulationResults(
    id: string,
    options: { stationCode?: string; withResults?: boolean } = {},
    signal?: AbortSignal,
): Promise<SimulationResultsResponse> {
    const params: Record<string, string | boolean> = {};
    if (options.stationCode) params.stationCode = options.stationCode;
    if (options.withResults) params.withResults = true;

    const { data } = await gatewayClient.get(`/simulations/manual/${id}/results`, { params, signal });
    return data as SimulationResultsResponse;
}

// ── What was actually sent to the model ───────────────────────

/**
 * Reads the generated input file and returns the series per reservoir.
 *
 * The persisted maneuver only keeps `outputFlowValue`, so a pasted curve exists
 * nowhere but in this file — which makes the file the only honest answer to "what
 * did we send?". Read rather than downloaded: the same endpoint the download
 * button uses, kept as text so it can be charted.
 */
export async function fetchSimulationInputSeries(
    simulationId: string,
    fileName: string,
    signal?: AbortSignal,
): Promise<InputSeries[]> {
    const { data } = await gatewayClient.get(`/simulations/${simulationId}/files/download`, {
        params: { folder: 'input', name: fileName },
        responseType: 'text',
        transformResponse: [(raw) => raw],
        signal,
    });

    const document = JSON.parse(data as string) as {
        timeSeries?: {
            header?: { locationId?: string; units?: string; missVal?: string };
            events?: { date: string; time: string; value: string }[];
        }[];
    };

    return (document.timeSeries ?? []).map((series) => {
        const missVal = series.header?.missVal ?? '-999.0';
        return {
            reservoirCode: series.header?.locationId ?? '?',
            unit: series.header?.units ?? '',
            points: (series.events ?? [])
                .filter((event) => event.value !== missVal)
                // The file is UTC (timeZone 0.0), so the stamps are read as UTC.
                .map((event) => ({ date: `${event.date}T${event.time}Z`, value: Number(event.value) }))
                .filter((point) => Number.isFinite(point.value)),
        };
    });
}
