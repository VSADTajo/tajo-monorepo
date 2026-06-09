import { Request, Response } from "express";
import { ForecastService } from "../services/forecast.service";
import { StrategyType, JobType } from "../types/forecast.types";

export class ForecastController {
    static async createForecast(req: Request, res: Response) {
        try {
            const { basin, strategy, model, jobType, parameterId, units, events, startDate, endDate, jobId, metadata } =
                req.body;

            if (!basin || !strategy || !jobType || !events || !Array.isArray(events)) {
                return res.status(400).json({
                    message: "Missing required fields: basin, strategy, jobType, and events are required",
                });
            }

            const payload: Parameters<typeof ForecastService.createForecast>[0] = {
                basin,
                strategy,
                jobType,
                events,
            };
            if (model !== undefined) payload.model = model;
            if (parameterId !== undefined) payload.parameterId = parameterId;
            if (units !== undefined) payload.units = units;
            if (startDate) payload.startDate = new Date(startDate);
            if (endDate) payload.endDate = new Date(endDate);
            if (jobId !== undefined) payload.jobId = jobId;
            if (metadata !== undefined) payload.metadata = metadata;
            const newForecast = await ForecastService.createForecast(payload);

            res.status(201).json(newForecast);
        } catch (error) {
            console.error("Error in createForecast:", error);
            res.status(500).json({ message: "Internal server error in createForecast" });
        }
    }

    static async createManyForecasts(req: Request, res: Response) {
        try {
            const { forecasts } = req.body;

            if (!forecasts || !Array.isArray(forecasts)) {
                return res.status(400).json({
                    message: "forecasts array is required",
                });
            }

            const newForecasts = await ForecastService.createManyForecasts(forecasts);
            res.status(201).json(newForecasts);
        } catch (error) {
            console.error("Error in createManyForecasts:", error);
            res.status(500).json({ message: "Internal server error in createManyForecasts" });
        }
    }

    static async getForecasts(req: Request, res: Response) {
        try {
            const forecasts = await ForecastService.getForecasts();
            res.status(200).json(forecasts);
        } catch (error) {
            console.error("Error in getForecasts:", error);
            res.status(500).json({ message: "Internal server error in getForecasts" });
        }
    }

    static async getForecastsFiltered(req: Request, res: Response) {
        try {
            const { basin, strategy, jobType, jobId, dateFrom, dateTo, simulationHour, ensemble } = req.query as {
                basin?: string;
                strategy?: StrategyType;
                jobType?: JobType;
                jobId?: string;
                dateFrom?: string;
                dateTo?: string;
                simulationHour?: string;
                ensemble?: string;
            };

            let fromDate: Date | undefined;
            let toDate: Date | undefined;

            if (dateFrom) {
                const d = new Date(dateFrom);
                if (isNaN(d.getTime())) {
                    return res.status(400).json({ message: "Invalid dateFrom" });
                }
                fromDate = d;
            }

            if (dateTo) {
                const d = new Date(dateTo);
                if (isNaN(d.getTime())) {
                    return res.status(400).json({ message: "Invalid dateTo" });
                }
                toDate = d;
            }

            if (strategy && !Object.values(StrategyType).includes(strategy as StrategyType)) {
                return res.status(400).json({ message: "Invalid strategy. Allowed: smc, ecmwf, wrf" });
            }

            if (jobType && !Object.values(JobType).includes(jobType as JobType)) {
                return res.status(400).json({ message: "Invalid jobType. Allowed: forecast, historical" });
            }

            const params: {
                basin?: string;
                strategy?: StrategyType;
                jobType?: JobType;
                jobId?: string;
                fromDate?: Date;
                toDate?: Date;
                simulationHour?: string;
                ensemble?: string;
            } = {};

            if (basin !== undefined) params.basin = basin;
            if (strategy !== undefined) params.strategy = strategy as StrategyType;
            if (jobType !== undefined) params.jobType = jobType as JobType;
            if (jobId !== undefined) params.jobId = jobId;
            if (fromDate !== undefined) params.fromDate = fromDate;
            if (toDate !== undefined) params.toDate = toDate;
            if (simulationHour !== undefined) params.simulationHour = simulationHour;
            if (ensemble !== undefined) params.ensemble = ensemble;

            const forecasts = await ForecastService.getForecastsFiltered(params);
            res.status(200).json(forecasts);
        } catch (error) {
            console.error("Error in getForecastsFiltered:", error);
            res.status(500).json({ message: "Internal server error in getForecastsFiltered" });
        }
    }

    static async getForecastById(req: Request, res: Response) {
        try {
            const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
            if (!id) {
                return res.status(400).json({ message: "ID parameter is required" });
            }

            const forecast = await ForecastService.getForecastById(id);
            if (!forecast) {
                return res.status(404).json({ message: "Forecast not found" });
            }

            res.status(200).json(forecast);
        } catch (error) {
            console.error("Error in getForecastById:", error);
            res.status(500).json({ message: "Internal server error in getForecastById" });
        }
    }

    static async getTotalCount(req: Request, res: Response) {
        try {
            const count = await ForecastService.getTotalCount();
            res.status(200).json({ count });
        } catch (error) {
            console.error("Error in getTotalCount:", error);
            res.status(500).json({ message: "Internal server error in getTotalCount" });
        }
    }

    static async getCountByBasin(req: Request, res: Response) {
        try {
            const basin = typeof req.params.basin === "string" ? req.params.basin : req.params.basin?.[0];
            if (!basin) {
                return res.status(400).json({ message: "Basin parameter is required" });
            }
            const count = await ForecastService.getCountByBasin(basin);
            res.status(200).json({ count });
        } catch (error) {
            console.error("Error in getCountByBasin:", error);
            res.status(500).json({ message: "Internal server error in getCountByBasin" });
        }
    }

    static async getCountByStrategy(req: Request, res: Response) {
        try {
            const strategy = typeof req.params.strategy === "string" ? req.params.strategy : req.params.strategy?.[0];
            if (!strategy) {
                return res.status(400).json({ message: "Strategy parameter is required" });
            }

            if (!Object.values(StrategyType).includes(strategy as StrategyType)) {
                return res.status(400).json({ message: "Invalid strategy. Allowed: smc, ecmwf, wrf" });
            }

            const count = await ForecastService.getCountByStrategy(strategy as StrategyType);
            res.status(200).json({ count });
        } catch (error) {
            console.error("Error in getCountByStrategy:", error);
            res.status(500).json({ message: "Internal server error in getCountByStrategy" });
        }
    }

    static async getAllBasins(req: Request, res: Response) {
        try {
            const basins = await ForecastService.getAllBasins();
            res.status(200).json(basins);
        } catch (error) {
            console.error("Error in getAllBasins:", error);
            res.status(500).json({ message: "Internal server error in getAllBasins" });
        }
    }

    static async getAllStrategies(req: Request, res: Response) {
        try {
            const strategies = await ForecastService.getAllStrategies();
            res.status(200).json(strategies);
        } catch (error) {
            console.error("Error in getAllStrategies:", error);
            res.status(500).json({ message: "Internal server error in getAllStrategies" });
        }
    }

    static async getAllSimulationDates(req: Request, res: Response) {
        try {
            const dates = await ForecastService.getAllSimulationDates();
            res.status(200).json(dates);
        } catch (error) {
            console.error("Error in getAllSimulationDates:", error);
            res.status(500).json({ message: "Internal server error in getAllSimulationDates" });
        }
    }

    static async getAllEnsembles(req: Request, res: Response) {
        try {
            const ensembles = await ForecastService.getAllEnsembles();
            res.status(200).json(ensembles);
        } catch (error) {
            console.error("Error in getAllEnsembles:", error);
            res.status(500).json({ message: "Internal server error in getAllEnsembles" });
        }
    }

    static async deleteForecastById(req: Request, res: Response) {
        try {
            const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
            if (!id) {
                return res.status(400).json({ message: "ID parameter is required" });
            }

            const result = await ForecastService.deleteForecastById(id);
            if (!result) {
                return res.status(404).json({ message: "Forecast not found" });
            }

            res.status(200).json({ message: "Forecast deleted successfully" });
        } catch (error) {
            console.error("Error in deleteForecastById:", error);
            res.status(500).json({ message: "Internal server error in deleteForecastById" });
        }
    }

    static async deleteForecastsByJobId(req: Request, res: Response) {
        try {
            const jobId = typeof req.params.jobId === "string" ? req.params.jobId : req.params.jobId?.[0];
            if (!jobId) {
                return res.status(400).json({ message: "jobId parameter is required" });
            }

            const result = await ForecastService.deleteForecastsByJobId(jobId);
            res.status(200).json({
                message: "Forecasts deleted successfully",
                deletedCount: result.deletedCount,
            });
        } catch (error) {
            console.error("Error in deleteForecastsByJobId:", error);
            res.status(500).json({ message: "Internal server error in deleteForecastsByJobId" });
        }
    }
}
