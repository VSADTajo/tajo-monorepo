import apiClient from '../../api/api';
import { IOType, DownloadFormat, IOHistoryListResponse, IOHistoryProviders } from '../../types/io-history';

export async function getIOHistoryFiles(params: {
  ioType: IOType;
  provider?: string;
  fromDate?: string;
  toDate?: string;
  ensemble?: string;
  simulationEnvironment?: string;
  page?: number;
  pageSize?: number;
}): Promise<IOHistoryListResponse> {
  const queryParams = new URLSearchParams();
  if (params.provider) queryParams.set('provider', params.provider);
  if (params.fromDate) queryParams.set('from_date', params.fromDate);
  if (params.toDate) queryParams.set('to_date', params.toDate);
  if (params.ensemble) queryParams.set('ensemble', params.ensemble);
  if (params.simulationEnvironment) queryParams.set('simulation_environment', params.simulationEnvironment);
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.pageSize) queryParams.set('page_size', params.pageSize.toString());

  const endpoint = params.ioType === IOType.INPUT ? 'input' : 'output';
  const response = await apiClient.get<IOHistoryListResponse>(
    `/io-history/${endpoint}?${queryParams.toString()}`
  );

  return response.data;
}

export async function getIOHistoryProviders(): Promise<IOHistoryProviders> {
  const response = await apiClient.get<IOHistoryProviders>('/io-history/providers');
  return response.data;
}

export interface SimulationDatesResponse {
  simulation_dates: string[];
  count: number;
}

export async function getSimulationDates(params?: {
  ioType?: string;
  provider?: string;
}): Promise<SimulationDatesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.ioType) queryParams.set('io_type', params.ioType);
  if (params?.provider) queryParams.set('provider', params.provider);

  const response = await apiClient.get<SimulationDatesResponse>(
    `/io-history/simulation-dates?${queryParams.toString()}`
  );
  return response.data;
}

export async function downloadIOHistoryFile(
  ioType: IOType,
  provider: string,
  filename: string,
  format: DownloadFormat
): Promise<Blob> {
  const endpoint = ioType === IOType.INPUT ? 'input' : 'output';
  const response = await apiClient.get(
    `/io-history/${endpoint}/${provider}/${filename}/download?format=${format}`,
    { responseType: 'blob' }
  );

  return response.data;
}
