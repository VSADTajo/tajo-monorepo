import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import type { StationPredictionTypesResponse } from '../../types/prediction-types';

// Gateway client — prediction-type queries go through the API gateway, same as administration/hydro.
const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export async function getPredictionTypesByStation(stationCode: string): Promise<StationPredictionTypesResponse> {
    const { data } = await gatewayClient.get(`/prediction-types/by-station/${encodeURIComponent(stationCode)}`);
    return data as StationPredictionTypesResponse;
}
