import Forecast from "../collections/forecast.collection";
import { ForecastData, StrategyType, JobType } from "../types/forecast.types";

export class ForecastService {
    static async createForecast(forecast: ForecastData) {
        const newForecast = await Forecast.create(forecast);
        return newForecast;
    }

    static async createManyForecasts(forecasts: ForecastData[]) {
        const newForecasts = await Forecast.insertMany(forecasts);
        return newForecasts;
    }

    static async getForecasts() {
        const forecasts = await Forecast.find().sort({ createdAt: -1 });
        return forecasts;
    }

    static async getForecastsFiltered(params: {
        basin?: string;
        strategy?: StrategyType;
        jobType?: JobType;
        jobId?: string;
        fromDate?: Date;
        toDate?: Date;
        simulationHour?: string;
        ensemble?: string;
    }) {
        const { basin, strategy, jobType, jobId, fromDate, toDate, simulationHour, ensemble } = params;
        const filter: Record<string, any> = {};

        if (basin) {
            filter.basin = basin;
        }

        if (strategy) {
            filter.strategy = strategy;
        }

        if (jobType) {
            filter.jobType = jobType;
        }

        if (jobId) {
            filter.jobId = jobId;
        }

        if (simulationHour) {
            // Convert to number if it's a numeric string
            const hourValue = !isNaN(Number(simulationHour)) ? Number(simulationHour) : simulationHour;
            filter["metadata.simulation_hour"] = hourValue;
        }

        if (ensemble) {
            filter["metadata.ensemble"] = ensemble;
        }

        if (fromDate || toDate) {
            filter.createdAt = {} as any;
            if (fromDate) filter.createdAt.$gte = fromDate;
            if (toDate) filter.createdAt.$lte = toDate;
        }

        const forecasts = await Forecast.find(filter).sort({ createdAt: -1 });
        return forecasts;
    }

    static async getForecastById(id: string) {
        const forecast = await Forecast.findById(id);
        return forecast;
    }

    static async getTotalCount(): Promise<number> {
        const count = await Forecast.countDocuments();
        return count;
    }

    static async getCountByBasin(basin: string): Promise<number> {
        const count = await Forecast.countDocuments({ basin });
        return count;
    }

    static async getCountByStrategy(strategy: StrategyType): Promise<number> {
        const count = await Forecast.countDocuments({ strategy });
        return count;
    }

    static async getAllBasins(): Promise<string[]> {
        const basins = await Forecast.distinct("basin");
        return basins.sort();
    }

    static async getAllStrategies(): Promise<string[]> {
        const strategies = await Forecast.distinct("strategy");
        return strategies.sort();
    }

    static async getAllSimulationDates(): Promise<string[]> {
        const dates = await Forecast.distinct("metadata.simulation_hour");
        // Convert numbers to strings and sort
        return dates
            .filter((d: any) => d !== null && d !== undefined)
            .map((d: any) => String(d))
            .sort((a: string, b: string) => Number(b) - Number(a));
    }

    static async getAllEnsembles(): Promise<string[]> {
        const ensembles = await Forecast.distinct("metadata.ensemble");
        return ensembles.filter((e: any) => e !== null && e !== undefined).sort();
    }

    static async deleteForecastById(id: string) {
        const result = await Forecast.findByIdAndDelete(id);
        return result;
    }

    static async deleteForecastsByJobId(jobId: string) {
        const result = await Forecast.deleteMany({ jobId });
        return result;
    }
}
