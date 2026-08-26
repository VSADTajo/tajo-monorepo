import axios from 'axios';
import { TOKEN_KEY } from '../../api/auth';
import type {
  IngestionRun,
  ListIngestionRunsResponse,
  ListProvidersResponse,
  ProviderConfig,
  ProviderFormValues,
} from './types';

// All provider administration goes through the API gateway — ms-model-api is
// not reachable from a browser, and its own whitelist only lets the gateway in.
const GATEWAY_URL = import.meta.env.VITE_URL_API_GATEWAY || 'http://65.21.97.113';

const gatewayClient = axios.create({ baseURL: GATEWAY_URL });

gatewayClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** A manual run executes the whole ingestion before answering. */
const TRIGGER_TIMEOUT_MS = 300_000;

export async function listProviders(): Promise<ProviderConfig[]> {
  const { data } = await gatewayClient.get<ListProvidersResponse>('/model/provider-configs');
  return data.providerConfigs ?? [];
}

export async function createProvider(values: ProviderFormValues): Promise<ProviderConfig> {
  const { data } = await gatewayClient.post<ProviderConfig>('/model/provider-configs', values);
  return data;
}

export async function updateProvider(
  id: string,
  values: Partial<ProviderFormValues>,
): Promise<ProviderConfig> {
  const { data } = await gatewayClient.put<ProviderConfig>(`/model/provider-configs/${id}`, values);
  return data;
}

export async function toggleProvider(id: string): Promise<ProviderConfig> {
  const { data } = await gatewayClient.patch<ProviderConfig>(`/model/provider-configs/${id}/toggle`);
  return data;
}

export async function triggerIngestion(id: string): Promise<IngestionRun> {
  const { data } = await gatewayClient.post<IngestionRun>(
    `/model/provider-configs/${id}/trigger`,
    undefined,
    { timeout: TRIGGER_TIMEOUT_MS },
  );
  return data;
}

export async function deleteProvider(id: string): Promise<void> {
  await gatewayClient.delete(`/model/provider-configs/${id}`);
}

export async function listIngestionRuns(providerConfigId?: string): Promise<IngestionRun[]> {
  const { data } = await gatewayClient.get<ListIngestionRunsResponse>('/model/ingestion-runs', {
    params: providerConfigId ? { providerConfigId } : undefined,
  });
  return data.runs ?? [];
}

/** Turns an axios failure into something worth showing next to the button. */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { ErrorDescription?: string; message?: string } | undefined;
    return data?.ErrorDescription || data?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
