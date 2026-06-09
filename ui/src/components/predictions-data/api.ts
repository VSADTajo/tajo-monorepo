import apiClient from '../../api/api';
import type {
  PaginatedHistoricalSimulationResponse,
  HistoricalSimulationsParams,
  PredictionResultResponse,
  PredictionResultsParams,
  Station,
} from '../../types/predictions-data';

export async function getHistoricalSimulations(
  params: HistoricalSimulationsParams
): Promise<PaginatedHistoricalSimulationResponse> {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.page_size != null) search.set('page_size', String(params.page_size));
  if (params.simulation_environment) search.set('simulation_environment', params.simulation_environment);
  if (params.basin) search.set('basin', params.basin);
  if (params.created_by) search.set('created_by', params.created_by);
  if (params.maneuver_created_by) search.set('maneuver_created_by', params.maneuver_created_by);
  if (params.only_unarchived_maneuvers != null)
    search.set('only_unarchived_maneuvers', String(params.only_unarchived_maneuvers));

  const response = await apiClient.get<PaginatedHistoricalSimulationResponse>(
    `/predictions-data/simulations/historical?${search.toString()}`
  );
  return response.data;
}

export async function getPredictionResults(
  params: PredictionResultsParams
): Promise<PredictionResultResponse[]> {
  const search = new URLSearchParams();
  search.set('start_date', params.start_date);
  search.set('end_date', params.end_date);
  if (params.simulation_date) search.set('simulation_date', params.simulation_date);
  if (params.station_name) search.set('station_name', params.station_name);
  if (params.sub_basin_name) search.set('sub_basin_name', params.sub_basin_name);
  if (params.prediction_type) search.set('prediction_type', params.prediction_type);
  if (params.prediction_provider != null) search.set('prediction_provider', params.prediction_provider);
  if (params.predicted_by) search.set('predicted_by', params.predicted_by);
  if (params.percentile != null) search.set('percentile', String(params.percentile));

  const response = await apiClient.get<PredictionResultResponse[]>(
    `/predictions-data/prediction-results?${search.toString()}`
  );
  return response.data;
}

export async function getStations(limit = 1000): Promise<Station[]> {
  const response = await apiClient.get<Station[]>(
    `/predictions-data/stations?limit=${limit}`
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function getHistoricalPredictions(
  subBasinName: string,
  startDate: string,
  endDate: string,
  simulationDate?: string
): Promise<PredictionResultResponse[]> {
  const search = new URLSearchParams();
  search.set('start_date', startDate);
  search.set('end_date', endDate);
  if (simulationDate) search.set('simulation_date', simulationDate);
  const response = await apiClient.get<PredictionResultResponse[]>(
    `/predictions-data/historical-predictions/${encodeURIComponent(subBasinName)}?${search.toString()}`
  );
  return Array.isArray(response.data) ? response.data : [];
}
