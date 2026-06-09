/** Maneuver from scheduler (optional in simulation) */
export interface HistoricalManeuver {
    archived?: boolean;
    created_by?: string;
    [key: string]: unknown;
}

/** Single historical simulation group by simulation_date */
export interface HistoricalSimulationResponse {
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

/** Paginated response from GET /api/v1/simulations/historical */
export interface PaginatedHistoricalSimulationResponse {
    simulations: HistoricalSimulationResponse[];
    total_count: number;
    total_pages: number;
    current_page: number;
    page_size: number;
}

export interface HistoricalSimulationsQuery {
    simulation_environment?: string;
    basin?: string;
    created_by?: string;
    maneuver_created_by?: string;
    page?: number;
    page_size?: number;
    only_unarchived_maneuvers?: boolean;
}

/** Single prediction result from GET /api/v1/prediction-results/ */
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

export interface PredictionResultsQuery {
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

/** Station from GET /api/v1/stations/ */
export interface StationResponse {
    sub_basin_name?: string;
    name?: string;
    [key: string]: unknown;
}

/** GET /api/v1/historical-predictions/:subBasinName - same shape as prediction-results array */
export type HistoricalPredictionsResponse = PredictionResultResponse[];
