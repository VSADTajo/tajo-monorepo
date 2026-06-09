import { Request, Response } from "express";
import { ReportsService } from "../services/reports.service";

function queryParam(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
    return typeof value === "string" ? value : undefined;
}

function queryNumber(value: unknown): number | undefined {
    const s = queryParam(value);
    if (s == null) return undefined;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? undefined : n;
}

export class ReportsController {
    static async listReports(req: Request, res: Response) {
        try {
            const provider = queryParam(req.query.provider) ?? "WRF";
            const rawSim = queryParam(req.query.simulation_date);
            const simulation_date = rawSim != null && rawSim.length >= 10 ? rawSim.slice(0, 10) : undefined;
            const limit = queryNumber(req.query.limit);
            const offset = queryNumber(req.query.offset) ?? 0;
            const query: { provider: string; simulation_date?: string; limit?: number; offset: number } = {
                provider,
                offset,
            };
            if (simulation_date != null) query.simulation_date = simulation_date;
            if (limit != null) query.limit = limit;
            const result = await ReportsService.listReports(query);
            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in listReports:", error);
            if (error.response) {
                return res.status(error.response.status).json(
                    error.response.data ?? { message: "Error from reports API" }
                );
            }
            res.status(500).json({ message: "Internal server error in listReports" });
        }
    }

    static async downloadReport(req: Request, res: Response) {
        try {
            const rawFilename = req.params.filename;
            const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
            if (!filename) {
                return res.status(400).json({ message: "filename is required" });
            }

            const result = await ReportsService.downloadReport(filename);

            res.setHeader("Content-Type", result.contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
            res.setHeader("Content-Length", result.data.length);
            res.send(result.data);
        } catch (error: any) {
            console.error("Error in downloadReport:", error);
            if (error.response) {
                return res.status(error.response.status).json(
                    error.response.data ?? { message: "Error from reports API" }
                );
            }
            res.status(500).json({ message: "Internal server error in downloadReport" });
        }
    }

    static async deleteReport(req: Request, res: Response) {
        try {
            const rawFilename = req.params.filename;
            const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
            if (!filename) {
                return res.status(400).json({ message: "filename is required" });
            }
            await ReportsService.deleteReport(filename);
            res.status(204).send();
        } catch (error: any) {
            console.error("Error in deleteReport:", error);
            if (error.response) {
                return res.status(error.response.status).json(
                    error.response.data ?? { message: "Error from reports API" }
                );
            }
            res.status(500).json({ message: "Internal server error in deleteReport" });
        }
    }

    static async generateReport(req: Request, res: Response) {
        try {
            const force =
                typeof (req.body as any)?.force === "boolean"
                    ? (req.body as any).force
                    : false;

            const result = await ReportsService.generatePrevCabReport(force);
            res.status(200).json(result);
        } catch (error: any) {
            console.error("Error in generateReport:", error);
            if (error.response) {
                return res.status(error.response.status).json(
                    error.response.data ?? { message: "Error from tasks API" }
                );
            }
            res.status(500).json({ message: "Internal server error in generateReport" });
        }
    }
}

