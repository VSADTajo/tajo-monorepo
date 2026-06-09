// Prediction providers que usan predictions-api como input
// Thingsboard Data usa ThingsBoard, no predictions-api
export type PredictionProvider = 'WRF' | 'ECMWF';
export type PredictionType = 'Discharge' | 'Precipitation' | 'Discharge_forecast' | 'Precipitation_forecast' | 'C.for' | 'C.hist' | 'V.for' | 'V.hist' | 'Qo.for';

export interface PredictionResult {
  id: number;
  prediction_id: number;
  date_timestamp: number; // Unix timestamp in seconds
  value: number;
  created_at: string;
  station_name: string;
  sub_basin_name: string;
  prediction_type: PredictionType;
  prediction_provider: PredictionProvider;
  simulation_date: string; // Format: YYYYMMDDHH
  ensemble: string; // e.g., "000", "062"
  percentile_prediction: number | null; // For ECMWF: 10, 25, 50, 75, 90
  predicted_by: string | null;
}

export interface PredictionGroup {
  prediction_id: number;
  station_name: string;
  sub_basin_name: string;
  prediction_type: PredictionType;
  prediction_provider: PredictionProvider;
  simulation_date: string;
  ensemble: string;
  percentile: number | null;
  results_count: number;
  results: PredictionResult[];
  min_date: number;
  max_date: number;
}

export interface PredictionsFilterParams {
  prediction_provider?: PredictionProvider;
  sub_basin_name?: string;
  station_name?: string;
  prediction_type?: PredictionType;
  ensemble?: string;
  percentile?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}
