import axios from "axios";
import {
    PaginatedHistoricalSimulationResponse,
    HistoricalSimulationsQuery,
    PredictionResultResponse,
    PredictionResultsQuery,
    StationResponse,
    HistoricalPredictionsResponse,
} from "../types/predictions-simulations.types";

const SIMULATIONS_API_URL =
    process.env.PREDICTIONS_SIMULATIONS_API_URL || "http://37.27.133.251:8000";

export class PredictionsSimulationsService {
    private static getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
        };
        const bearerToken = process.env.PREDICTIONS_SIMULATIONS_BEARER_TOKEN;
        if (bearerToken) {
            headers["Authorization"] = `Bearer ${bearerToken}`;
        } else {
            const apiKey =
                process.env.PREDICTIONS_SIMULATIONS_X_API_KEY || process.env.X_API_KEY;
            if (apiKey) {
                headers["x-api-key"] = apiKey;
            }
        }
        return headers;
    }

    static async getHistoricalSimulations(
        params: HistoricalSimulationsQuery
    ): Promise<PaginatedHistoricalSimulationResponse> {
        const query: Record<string, string | number | boolean | undefined> = {
            page: params.page ?? 1,
            page_size: params.page_size ?? 24,
        };
        if (params.simulation_environment != null)
            query.simulation_environment = params.simulation_environment;
        if (params.basin != null) query.basin = params.basin;
        if (params.created_by != null) query.created_by = params.created_by;
        if (params.maneuver_created_by != null)
            query.maneuver_created_by = params.maneuver_created_by;
        if (params.only_unarchived_maneuvers != null)
            query.only_unarchived_maneuvers = params.only_unarchived_maneuvers;

        const response = await axios.get<PaginatedHistoricalSimulationResponse>(
            `${SIMULATIONS_API_URL}/api/v1/simulations/historical`,
            {
                params: query,
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }

    static async getPredictionResults(
        params: PredictionResultsQuery
    ): Promise<PredictionResultResponse[]> {
        const query: Record<string, string | number | undefined> = {
            start_date: params.start_date,
            end_date: params.end_date,
        };
        if (params.simulation_date != null) query.simulation_date = params.simulation_date;
        if (params.station_name != null) query.station_name = params.station_name;
        if (params.sub_basin_name != null) query.sub_basin_name = params.sub_basin_name;
        if (params.prediction_type != null) query.prediction_type = params.prediction_type;
        if (params.prediction_provider != null)
            query.prediction_provider = params.prediction_provider;
        if (params.predicted_by != null) query.predicted_by = params.predicted_by;
        if (params.percentile != null) query.percentile = params.percentile;

        const response = await axios.get<PredictionResultResponse[]>(
            `${SIMULATIONS_API_URL}/api/v1/prediction-results/`,
            {
                params: query,
                headers: this.getHeaders(),
            }
        );
        return response.data;
    }

    static async getStations(limit: number = 1000): Promise<StationResponse[]> {
        const response = await axios.get<StationResponse[]>(
            `${SIMULATIONS_API_URL}/api/v1/stations/`,
            {
                params: { limit },
                headers: this.getHeaders(),
            }
        );
        return Array.isArray(response.data) ? response.data : [];
    }

    static async getHistoricalPredictions(
        subBasinName: string,
        startDate: string,
        endDate: string,
        simulationDate?: string
    ): Promise<HistoricalPredictionsResponse> {
        const params: Record<string, string> = {
            start_date: startDate,
            end_date: endDate,
        };
        if (simulationDate != null && simulationDate !== "")
            params.simulation_date = simulationDate;

        const response = await axios.get<HistoricalPredictionsResponse>(
            `${SIMULATIONS_API_URL}/api/v1/historical-predictions/${encodeURIComponent(subBasinName)}`,
            {
                params,
                headers: this.getHeaders(),
            }
        );
        return Array.isArray(response.data) ? response.data : [];
    }
}
