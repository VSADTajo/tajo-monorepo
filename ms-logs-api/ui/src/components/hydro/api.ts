import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import type { Basin, SubBasin, Station, ResguardosByStation, ResguardoByDate, RawResguardoValues } from '../../types/hydro';

const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Basins ────────────────────────────────────────────────────

export async function listBasins() {
    const { data } = await gatewayClient.get('/basins', { params: { limit: 500 } });
    return data as { items: Basin[]; total: number };
}

export async function createBasin(payload: { name: string; code: string; description?: string }) {
    const { data } = await gatewayClient.post('/basins', payload);
    return data as Basin;
}

export async function updateBasin(id: string, payload: { name?: string; code?: string; description?: string | null }) {
    const { data } = await gatewayClient.put(`/basins/${id}`, payload);
    return data as Basin;
}

export async function toggleBasin(id: string) {
    const { data } = await gatewayClient.patch(`/basins/${id}/toggle`);
    return data as { id: string; isActive: boolean };
}

export async function deleteBasin(id: string) {
    await gatewayClient.delete(`/basins/${id}`);
}

// ── Sub-Basins ────────────────────────────────────────────────

export async function listSubBasins(basinId?: string) {
    const params: Record<string, string | number> = { limit: 500 };
    if (basinId) params.basinId = basinId;
    const { data } = await gatewayClient.get('/sub-basins', { params });
    return data as { items: SubBasin[]; total: number };
}

export async function createSubBasin(payload: { name: string; code: string; basinId: string; description?: string }) {
    const { data } = await gatewayClient.post('/sub-basins', payload);
    return data as SubBasin;
}

export async function updateSubBasin(id: string, payload: { name?: string; code?: string; description?: string | null }) {
    const { data } = await gatewayClient.put(`/sub-basins/${id}`, payload);
    return data as SubBasin;
}

export async function toggleSubBasin(id: string) {
    const { data } = await gatewayClient.patch(`/sub-basins/${id}/toggle`);
    return data as { id: string; isActive: boolean };
}

export async function deleteSubBasin(id: string) {
    await gatewayClient.delete(`/sub-basins/${id}`);
}

// ── Stations ──────────────────────────────────────────────────

export async function listStations(filters?: { subBasinId?: string; stationType?: string; isActive?: boolean }) {
    const params: Record<string, string | number | boolean> = { limit: 500 };
    if (filters?.subBasinId) params.subBasinId = filters.subBasinId;
    if (filters?.stationType) params.stationType = filters.stationType;
    if (filters?.isActive !== undefined) params.isActive = filters.isActive;
    const { data } = await gatewayClient.get('/stations', { params });
    return data as { items: Station[]; total: number };
}

export async function createStation(payload: {
    name: string;
    stationCode: string;
    stationType: string;
    subBasinId: string;
    subBasinName: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    description?: string;
}) {
    const { data } = await gatewayClient.post('/stations', payload);
    return data as Station;
}

export async function updateStation(
    id: string,
    payload: {
        name?: string;
        stationCode?: string;
        stationType?: string;
        latitude?: number | null;
        longitude?: number | null;
        altitude?: number | null;
        description?: string | null;
    },
) {
    const { data } = await gatewayClient.put(`/stations/${id}`, payload);
    return data as Station;
}

export async function toggleStation(id: string) {
    const { data } = await gatewayClient.patch(`/stations/${id}/toggle`);
    return data as { id: string; isActive: boolean };
}

export async function deleteStation(id: string) {
    await gatewayClient.delete(`/stations/${id}`);
}

export async function updateThreshold(id: string, payload: Record<string, number | string | null>) {
    const { data } = await gatewayClient.put(`/stations/${id}/threshold`, payload);
    return data;
}

// ── Resguardos ────────────────────────────────────────────────

export async function getResguardosByStation(stationCode: string, filters?: { from?: string; to?: string }) {
    const params: Record<string, string> = {};
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;
    const { data } = await gatewayClient.get(`/resguardos/${stationCode}`, { params });
    return data as ResguardosByStation;
}

export async function getResguardoByDate(stationCode: string, date: string) {
    const { data } = await gatewayClient.get(`/resguardos/${stationCode}/${date}`);
    return data as ResguardoByDate;
}

export async function updateResguardo(stationCode: string, date: string, payload: RawResguardoValues) {
    const { data } = await gatewayClient.put(`/resguardos/${stationCode}/${date}`, payload);
    return data as { entry: RawResguardoValues };
}
