import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import type {
    StationPredictionTypesResponse,
    CoverageMatrixResponse,
    StationOption,
} from '../../types/prediction-types';

// Gateway client — prediction-type queries go through the API gateway, same as administration/hydro.
const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

/** Coverage of ALL catalog prediction types for a station (with data / never + last ingestion). */
export async function getPredictionTypesByStation(stationCode: string): Promise<StationPredictionTypesResponse> {
    const { data } = await gatewayClient.get(`/prediction-types/by-station/${encodeURIComponent(stationCode)}`);
    return data as StationPredictionTypesResponse;
}

/** Full stations × types coverage matrix. */
export async function getCoverageMatrix(): Promise<CoverageMatrixResponse> {
    const { data } = await gatewayClient.get('/prediction-types/coverage');
    return data as CoverageMatrixResponse;
}

interface HydroStationListResponse {
    items?: Array<{ stationCode: string; name?: string | null }>;
}

/** Station catalog for autocomplete — pulled from the hydro stations endpoint via the gateway. */
export async function getStationOptions(): Promise<StationOption[]> {
    const { data } = await gatewayClient.get<HydroStationListResponse>('/stations', {
        params: { limit: 10000 },
    });
    const items = data?.items ?? [];
    return items.map((s) => ({ stationCode: s.stationCode, name: s.name ?? null }));
}

/** Trigger a browser download of a blob under the given filename. */
function triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

/** Download the per-station coverage report as an .xlsx file. */
export async function downloadStationReport(stationCode: string): Promise<void> {
    const response = await gatewayClient.get(
        `/prediction-types/by-station/${encodeURIComponent(stationCode)}/report.xlsx`,
        { responseType: 'blob' },
    );
    const safeCode = stationCode.replace(/[^a-zA-Z0-9._-]/g, '_');
    triggerDownload(response.data as Blob, `cobertura-${safeCode}.xlsx`);
}

/** Download the full coverage matrix as an .xlsx file. */
export async function downloadCoverageMatrixReport(): Promise<void> {
    const response = await gatewayClient.get('/prediction-types/coverage/report.xlsx', {
        responseType: 'blob',
    });
    triggerDownload(response.data as Blob, 'cobertura-todas-las-estaciones.xlsx');
}
