import api from '../../api/api';
import { ForecastEntry, ForecastsFilterParams } from '../../types/forecast';

export const getForecasts = async (): Promise<ForecastEntry[]> => {
  const response = await api.get<ForecastEntry[]>('/forecasts');
  return response.data;
};

export const getForecastsFiltered = async (params: ForecastsFilterParams): Promise<ForecastEntry[]> => {
  const response = await api.get<ForecastEntry[]>('/forecasts/filter', { params });
  return response.data;
};

export const getForecastById = async (id: string): Promise<ForecastEntry> => {
  const response = await api.get<ForecastEntry>(`/forecasts/${id}`);
  return response.data;
};

export const getTotalCount = async (): Promise<number> => {
  const response = await api.get<{ count: number }>('/forecasts/count');
  return response.data.count;
};

export const getAllBasins = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/forecasts/basins');
  return response.data;
};

export const getAllStrategies = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/forecasts/strategies');
  return response.data;
};

export const getAllSimulationDates = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/forecasts/simulation-dates');
  return response.data;
};

export const getAllEnsembles = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/forecasts/ensembles');
  return response.data;
};

export const getCountByBasin = async (basin: string): Promise<number> => {
  const response = await api.get<{ count: number }>(`/forecasts/basin/${basin}/count`);
  return response.data.count;
};
