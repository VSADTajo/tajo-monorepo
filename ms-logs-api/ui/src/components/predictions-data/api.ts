import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import type {
    ForecastResponse,
    ListPredictionTypesResponse,
    ListSimulationsResponse,
    SimulationFilesResponse,
    SimulationFilters,
    SimulationFolder,
} from './types';

// All predictions data goes through the API gateway — never hit ms-predictions-api directly.
const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Prediction types ──────────────────────────────────────────

export async function listPredictionTypes(signal?: AbortSignal): Promise<ListPredictionTypesResponse> {
    const { data } = await gatewayClient.get('/prediction-types', { signal });
    return data as ListPredictionTypesResponse;
}

// ── Simulations ───────────────────────────────────────────────

export async function listSimulations(
    filters: SimulationFilters,
    signal?: AbortSignal,
): Promise<ListSimulationsResponse> {
    const params: Record<string, string | number> = {
        stationCode: filters.stationCode,
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        sortBy: filters.sortBy ?? 'simulationDate',
        sortOrder: filters.sortOrder ?? 'DESC',
    };
    if (filters.status) params.status = filters.status;
    if (filters.dataOrigin) params.dataOrigin = filters.dataOrigin;

    const { data } = await gatewayClient.get('/simulations', { params, signal });
    return data as ListSimulationsResponse;
}

// ── Forecast series for a single simulation + prediction type ─

export async function getForecastSeries(
    args: { stationCode: string; simulationDate: string; predictionType: string },
    signal?: AbortSignal,
): Promise<ForecastResponse> {
    const { data } = await gatewayClient.get('/predictions/forecast', {
        params: {
            stationId: args.stationCode,
            simulationDate: args.simulationDate,
            predictionType: args.predictionType,
        },
        signal,
    });
    return data as ForecastResponse;
}

// ── Simulation SFTP files (input/output) ──────────────────────

export async function listSimulationFiles(
    simulationId: string,
    signal?: AbortSignal,
): Promise<SimulationFilesResponse> {
    const { data } = await gatewayClient.get(`/simulations/${simulationId}/files`, { signal });
    return data as SimulationFilesResponse;
}

// Downloads through the gateway (Bearer token injected by the interceptor), then saves the blob locally.
export async function downloadSimulationFile(
    simulationId: string,
    folder: SimulationFolder,
    name: string,
): Promise<void> {
    const { data } = await gatewayClient.get(`/simulations/${simulationId}/files/download`, {
        params: { folder, name },
        responseType: 'blob',
    });

    const url = URL.createObjectURL(data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
}
