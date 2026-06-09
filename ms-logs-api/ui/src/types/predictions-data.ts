export interface HistoricalManeuver {
  archived?: boolean;
  created_by?: string;
  [key: string]: unknown;
}

export interface HistoricalSimulation {
  simulation_date: string;
  formatted_date?: string;
  status: "finalized" | "in_progress";
  basin?: string;
  simulation_environment?: string;
  created_by?: string;
  modmeteos?: string[];
  maneuvers?: HistoricalManeuver[];
  [key: string]: unknown;
}

export interface PaginatedHistoricalSimulationResponse {
  simulations: HistoricalSimulation[];
  total_count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
}

export interface HistoricalSimulationsParams {
  simulation_environment?: string;
  basin?: string;
  created_by?: string;
  maneuver_created_by?: string;
  page?: number;
  page_size?: number;
  only_unarchived_maneuvers?: boolean;
}

export interface PredictionResultResponse {
  id: number;
  prediction_id: number;
  percentile_prediction: number | null;
  date_timestamp: number;
  value: number;
  created_at: string;
  station_name: string | null;
  sub_basin_name: string | null;
  prediction_type: string | null;
  prediction_provider: string | null;
  predicted_by: string | null;
  simulation_date: string | null;
  ensemble: string | null;
}

export interface PredictionResultsParams {
  start_date: string;
  end_date: string;
  simulation_date?: string;
  station_name?: string;
  sub_basin_name?: string;
  prediction_type?: string;
  prediction_provider?: string;
  predicted_by?: string;
  percentile?: number;
}

export interface Station {
  sub_basin_name?: string;
  name?: string;
  [key: string]: unknown;
}
