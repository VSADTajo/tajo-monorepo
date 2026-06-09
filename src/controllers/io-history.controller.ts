import { Request, Response } from "express";
import { IOHistoryService } from "../services/io-history.service";
import { IOType, DownloadFormat } from "../types/io-history.types";

interface IOHistoryListParams {
    provider?: string;
    from_date?: string;
    to_date?: string;
    ensemble?: string;
    simulation_environment?: string;
    page?: number;
    page_size?: number;
}

export class IOHistoryController {
    static async listInputFiles(req: Request, res: Response) {
        try {
            const { provider, from_date, to_date, ensemble, simulation_environment, page, page_size } = req.query as {
                provider?: string;
                from_date?: string;
                to_date?: string;
                ensemble?: string;
                simulation_environment?: string;
                page?: string;
                page_size?: string;
            };

            const listParams: IOHistoryListParams = {};
            if (provider !== undefined) listParams.provider = provider;
            if (from_date !== undefined) listParams.from_date = from_date;
            if (to_date !== undefined) listParams.to_date = to_date;
            if (ensemble !== undefined) listParams.ensemble = ensemble;
            if (simulation_environment !== undefined) listParams.simulation_environment = simulation_environment;
            if (page !== undefined) listParams.page = parseInt(page);
            if (page_size !== undefined) listParams.page_size = parseInt(page_size);
            const result = await IOHistoryService.listInputFiles(listParams);

            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in listInputFiles:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in listInputFiles" });
        }
    }

    static async listOutputFiles(req: Request, res: Response) {
        try {
            const { provider, from_date, to_date, ensemble, simulation_environment, page, page_size } = req.query as {
                provider?: string;
                from_date?: string;
                to_date?: string;
                ensemble?: string;
                simulation_environment?: string;
                page?: string;
                page_size?: string;
            };

            const listParams: IOHistoryListParams = {};
            if (provider !== undefined) listParams.provider = provider;
            if (from_date !== undefined) listParams.from_date = from_date;
            if (to_date !== undefined) listParams.to_date = to_date;
            if (ensemble !== undefined) listParams.ensemble = ensemble;
            if (simulation_environment !== undefined) listParams.simulation_environment = simulation_environment;
            if (page !== undefined) listParams.page = parseInt(page);
            if (page_size !== undefined) listParams.page_size = parseInt(page_size);
            const result = await IOHistoryService.listOutputFiles(listParams);

            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in listOutputFiles:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in listOutputFiles" });
        }
    }

    static async downloadInputFile(req: Request, res: Response) {
        try {
            const provider = typeof req.params.provider === "string" ? req.params.provider : req.params.provider?.[0];
            const filename = typeof req.params.filename === "string" ? req.params.filename : req.params.filename?.[0];
            if (!provider || !filename) {
                return res.status(400).json({ message: "provider and filename are required" });
            }
            const { format } = req.query as { format?: string };

            const downloadFormat = (format as DownloadFormat) || DownloadFormat.ORIGINAL;

            const result = await IOHistoryService.downloadFile(
                IOType.INPUT,
                provider,
                filename,
                downloadFormat
            );

            res.setHeader("Content-Type", result.contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
            res.setHeader("Content-Length", result.data.length);
            res.send(result.data);
        } catch (error: any) {
            console.error("Error in downloadInputFile:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in downloadInputFile" });
        }
    }

    static async downloadOutputFile(req: Request, res: Response) {
        try {
            const provider = typeof req.params.provider === "string" ? req.params.provider : req.params.provider?.[0];
            const filename = typeof req.params.filename === "string" ? req.params.filename : req.params.filename?.[0];
            if (!provider || !filename) {
                return res.status(400).json({ message: "provider and filename are required" });
            }
            const { format } = req.query as { format?: string };

            const downloadFormat = (format as DownloadFormat) || DownloadFormat.ORIGINAL;

            const result = await IOHistoryService.downloadFile(
                IOType.OUTPUT,
                provider,
                filename,
                downloadFormat
            );

            res.setHeader("Content-Type", result.contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
            res.setHeader("Content-Length", result.data.length);
            res.send(result.data);
        } catch (error: any) {
            console.error("Error in downloadOutputFile:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in downloadOutputFile" });
        }
    }

    static async getMetadata(req: Request, res: Response) {
        try {
            const result = await IOHistoryService.getMetadata();
            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in getMetadata:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in getMetadata" });
        }
    }

    static async getProviders(req: Request, res: Response) {
        try {
            const result = await IOHistoryService.getProviders();
            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in getProviders:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in getProviders" });
        }
    }

    static async getSimulationDates(req: Request, res: Response) {
        try {
            const { io_type, provider } = req.query as {
                io_type?: string;
                provider?: string;
            };

            const result = await IOHistoryService.getSimulationDates(io_type, provider);
            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in getSimulationDates:", error);
            if (error.response) {
                return res.status(error.response.status).json({
                    message: error.response.data?.detail || "Error from gateway",
                });
            }
            res.status(500).json({ message: "Internal server error in getSimulationDates" });
        }
    }
}
