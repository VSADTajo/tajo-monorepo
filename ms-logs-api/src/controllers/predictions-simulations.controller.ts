import { Request, Response } from "express";
import { PredictionsSimulationsService } from "../services/predictions-simulations.service";
import type {
    HistoricalSimulationsQuery,
    PredictionResultsQuery,
} from "../types/predictions-simulations.types";

function queryParam(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
    return typeof value === "string" ? value : undefined;
}

export class PredictionsSimulationsController {
    static async getHistoricalSimulations(req: Request, res: Response) {
        try {
            const {
                simulation_environment,
                basin,
                created_by,
                maneuver_created_by,
                page,
                page_size,
                only_unarchived_maneuvers,
            } = req.query as {
                simulation_environment?: string;
                basin?: string;
                created_by?: string;
                maneuver_created_by?: string;
                page?: string;
                page_size?: string;
                only_unarchived_maneuvers?: string;
            };

            const query: HistoricalSimulationsQuery = {
                page: page ? parseInt(page, 10) : 1,
                page_size: page_size ? parseInt(page_size, 10) : 24,
                only_unarchived_maneuvers:
                    only_unarchived_maneuvers === "true" ||
                    only_unarchived_maneuvers === "1",
            };
            if (simulation_environment !== undefined && simulation_environment !== "")
                query.simulation_environment = simulation_environment;
            if (basin !== undefined && basin !== "") query.basin = basin;
            if (created_by !== undefined && created_by !== "")
                query.created_by = created_by;
            if (maneuver_created_by !== undefined && maneuver_created_by !== "")
                query.maneuver_created_by = maneuver_created_by;

            const result = await PredictionsSimulationsService.getHistoricalSimulations(query);

            res.status(200).json(result);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown } };
            console.error("Error in getHistoricalSimulations:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(
                        err.response.data ?? { message: "Error from simulations API" }
                    );
            }
            res.status(500).json({ message: "Internal server error in getHistoricalSimulations" });
        }
    }

    static async getPredictionResults(req: Request, res: Response) {
        try {
            const {
                start_date,
                end_date,
                simulation_date,
                station_name,
                sub_basin_name,
                prediction_type,
                prediction_provider,
                predicted_by,
                percentile,
            } = req.query as {
                start_date?: string;
                end_date?: string;
                simulation_date?: string;
                station_name?: string;
                sub_basin_name?: string;
                prediction_type?: string;
                prediction_provider?: string;
                predicted_by?: string;
                percentile?: string;
            };

            if (!start_date || !end_date) {
                return res.status(400).json({
                    message: "start_date and end_date are required (ISO 8601)",
                });
            }

            const query: PredictionResultsQuery = { start_date, end_date };
            if (simulation_date !== undefined && simulation_date !== "")
                query.simulation_date = simulation_date;
            if (station_name !== undefined && station_name !== "")
                query.station_name = station_name;
            if (sub_basin_name !== undefined && sub_basin_name !== "")
                query.sub_basin_name = sub_basin_name;
            if (prediction_type !== undefined && prediction_type !== "")
                query.prediction_type = prediction_type;
            if (prediction_provider !== undefined && prediction_provider !== "")
                query.prediction_provider = prediction_provider;
            if (predicted_by !== undefined && predicted_by !== "")
                query.predicted_by = predicted_by;
            if (percentile !== undefined && percentile !== "") {
                const p = parseInt(percentile, 10);
                if (![10, 25, 50, 75, 90].includes(p)) {
                    return res.status(400).json({
                        message: "percentile must be one of 10, 25, 50, 75, 90",
                    });
                }
                query.percentile = p;
            }

            const result = await PredictionsSimulationsService.getPredictionResults(query);
            res.status(200).json(result);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown } };
            console.error("Error in getPredictionResults:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(
                        err.response.data ?? { message: "Error from prediction-results API" }
                    );
            }
            res.status(500).json({ message: "Internal server error in getPredictionResults" });
        }
    }

    static async getStations(req: Request, res: Response) {
        try {
            const { limit } = req.query as { limit?: string };
            const result = await PredictionsSimulationsService.getStations(
                limit ? parseInt(limit, 10) : 1000
            );
            res.status(200).json(result);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown } };
            console.error("Error in getStations:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(err.response.data ?? { message: "Error from stations API" });
            }
            res.status(500).json({ message: "Internal server error in getStations" });
        }
    }

    static async getHistoricalPredictions(req: Request, res: Response) {
        try {
            const subBasinName = queryParam(req.params.subBasinName);
            const start_date = queryParam(req.query.start_date);
            const end_date = queryParam(req.query.end_date);
            const simulation_date = queryParam(req.query.simulation_date);
            if (!subBasinName) {
                return res.status(400).json({ message: "subBasinName is required" });
            }
            if (!start_date || !end_date) {
                return res.status(400).json({
                    message: "start_date and end_date are required (ISO 8601)",
                });
            }
            const result = await PredictionsSimulationsService.getHistoricalPredictions(
                subBasinName,
                start_date,
                end_date,
                simulation_date
            );
            res.status(200).json(result);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown } };
            console.error("Error in getHistoricalPredictions:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(
                        err.response.data ?? {
                            message: "Error from historical-predictions API",
                        }
                    );
            }
            res.status(500).json({
                message: "Internal server error in getHistoricalPredictions",
            });
        }
    }
}
