import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import type {
    AerialAccumulation,
    AerialLayer,
    AerialProvider,
    AerialStat,
    ByLocationAerialResponse,
    LatestAerialResponse,
    ListAerialResponse,
} from '../../types/aerial-precipitation';

const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export interface ListParams {
    layer?: AerialLayer;
    provider?: AerialProvider;
    locationId?: string[];
    accumulation?: AerialAccumulation;
    stat?: Exclude<AerialStat, null>;
    fromForecastDate?: string;
    toForecastDate?: string;
    includeEvents?: boolean;
    page?: number;
    limit?: number;
}

export interface LatestParams {
    layer: AerialLayer;
    provider: AerialProvider;
    accumulation: AerialAccumulation;
    stat?: Exclude<AerialStat, null>;
    includeEvents?: boolean;
}

export interface ByLocationParams {
    provider?: AerialProvider;
    accumulation?: AerialAccumulation;
    fromForecastDate?: string;
    toForecastDate?: string;
    includeEvents?: boolean;
}

// Axios serializes arrays as `key[]=` by default; the upstream expects repeated
// `key=` params. Force the "repeat" form so `locationId=A&locationId=B` works.
const arrayParamsSerializer = {
    serialize: (params: Record<string, unknown>) => {
        const usp = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null) continue;
            if (Array.isArray(v)) v.forEach((item) => usp.append(k, String(item)));
            else usp.append(k, String(v));
        }
        return usp.toString();
    },
};

export async function listAerialPrecipitation(params: ListParams = {}): Promise<ListAerialResponse> {
    const { data } = await gatewayClient.get<ListAerialResponse>('/aerial-precipitation', {
        params,
        paramsSerializer: arrayParamsSerializer,
    });
    return data;
}

export async function getLatestAerialPrecipitation(params: LatestParams): Promise<LatestAerialResponse> {
    const { data } = await gatewayClient.get<LatestAerialResponse>('/aerial-precipitation/latest', {
        params,
        paramsSerializer: arrayParamsSerializer,
    });
    return data;
}

export async function getAerialPrecipitationByLocation(
    locationId: string,
    params: ByLocationParams = {},
): Promise<ByLocationAerialResponse> {
    const { data } = await gatewayClient.get<ByLocationAerialResponse>(
        `/aerial-precipitation/by-location/${encodeURIComponent(locationId)}`,
        { params, paramsSerializer: arrayParamsSerializer },
    );
    return data;
}
