export const PROVIDER_TYPES = ['WISKI_API', 'CSV_FILE', 'SFTP_FILE', 'FEWS_API'] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  pollingIntervalMinutes: number;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** ms-model-api spells the list key `providerConfigs`; this mirrors it verbatim. */
export interface ListProvidersResponse {
  providerConfigs: ProviderConfig[];
}

export type IngestionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface IngestionRun {
  id: string;
  providerConfigId: string;
  status: IngestionStatus;
  startedAt: string;
  completedAt: string | null;
  seriesCount: number;
  eventsCount: number;
  errorMessage: string | null;
}

export interface ListIngestionRunsResponse {
  runs: IngestionRun[];
}

export interface ProviderFormValues {
  name: string;
  type: ProviderType;
  baseUrl: string;
  pollingIntervalMinutes: number;
  settings: Record<string, unknown>;
}

/**
 * What each provider type expects in `settings`, so the form can offer real
 * fields instead of a bare JSON blob — and so a new provider does not need a
 * frontend change to be configurable: anything not listed here still round-trips
 * through the advanced JSON editor.
 */
export const SETTINGS_FIELDS: Record<
  ProviderType,
  { key: string; label: string; placeholder: string; hint?: string }[]
> = {
  WISKI_API: [
    {
      key: 'endpointPath',
      label: 'Path del endpoint',
      placeholder: '/wiski/tagus_flowcast_observado/',
    },
    {
      key: 'sourceTimezone',
      label: 'Zona horaria del origen',
      placeholder: 'Europe/Madrid',
      hint: 'El JSON no trae offset: si esto no coincide, todas las series quedan corridas.',
    },
  ],
  CSV_FILE: [
    { key: 'filePath', label: 'Directorio', placeholder: 'tajo/wiski' },
    { key: 'filePrefix', label: 'Prefijo del fichero', placeholder: 'Tagus_FlowCast' },
  ],
  SFTP_FILE: [
    { key: 'filePath', label: 'Directorio', placeholder: 'tajo' },
    { key: 'filePrefix', label: 'Prefijo del fichero', placeholder: 'Q_mod_input' },
  ],
  FEWS_API: [
    { key: 'filterId', label: 'Filter ID', placeholder: 'NAM_EPS' },
    { key: 'locationIds', label: 'Location IDs', placeholder: 'AR01,AR02' },
    { key: 'parameterIds', label: 'Parameter IDs', placeholder: 'Q.NAM.ens.Med' },
  ],
};

export const TYPE_LABELS: Record<ProviderType, string> = {
  WISKI_API: 'WISKI (API)',
  CSV_FILE: 'CSV por SFTP',
  SFTP_FILE: 'JSON por SFTP',
  FEWS_API: 'FEWS (API)',
};

export const TYPE_DESCRIPTIONS: Record<ProviderType, string> = {
  WISKI_API: 'Observados leídos por HTTP del servicio WISKI de la CH Tajo.',
  CSV_FILE: 'Observados leídos del CSV que WISKI deja en el SFTP.',
  SFTP_FILE: 'Entrada del modelo en JSON PI depositada en el SFTP.',
  FEWS_API: 'Series leídas del servicio PI REST de FEWS.',
};

export function defaultSettingsFor(type: ProviderType): Record<string, unknown> {
  switch (type) {
    case 'WISKI_API':
      return {
        endpointPath: '/wiski/tagus_flowcast_observado/',
        sourceTimezone: 'Europe/Madrid',
      };
    case 'CSV_FILE':
      return { filePath: 'tajo/wiski', filePrefix: 'Tagus_FlowCast' };
    case 'SFTP_FILE':
      return { filePath: 'tajo', filePrefix: 'Q_mod_input' };
    case 'FEWS_API':
      return { filterId: '', locationIds: '', parameterIds: '' };
    default:
      return {};
  }
}

export function defaultBaseUrlFor(type: ProviderType): string {
  switch (type) {
    case 'WISKI_API':
      return 'https://apisaih.saihchtajo.es';
    case 'CSV_FILE':
    case 'SFTP_FILE':
      return 'http://ms-sftp-api:3003';
    default:
      return '';
  }
}
