import { Request, Response } from "express";
import { ExportsService } from "../services/exports.service";

function queryParam(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
    return typeof value === "string" ? value : undefined;
}

export class ExportsController {
    static async listPredictionTypes(req: Request, res: Response) {
        try {
            const limit = req.query.limit != null ? Number(req.query.limit) : 100;
            const list = await ExportsService.getPredictionTypes(Number.isNaN(limit) ? 100 : limit);
            res.status(200).json(list);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown }; message?: string };
            console.error("Exports listPredictionTypes error:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(err.response.data ?? { detail: "Error from predictions API" });
            }
            res.status(500).json({ detail: err.message ?? "Internal server error" });
        }
    }

    static async listFiles(_req: Request, res: Response) {
        try {
            const result = await ExportsService.listFiles();
            res.status(200).json(result);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown }; message?: string };
            console.error("Exports listFiles error:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(err.response.data ?? { detail: "Error from exports API" });
            }
            res.status(500).json({ detail: err.message ?? "Internal server error" });
        }
    }

    static async downloadFile(req: Request, res: Response) {
        try {
            const filename = queryParam(req.params.filename);
            if (!filename) {
                return res.status(400).json({ detail: "Missing filename" });
            }
            const { buffer, contentType, contentDisposition } = await ExportsService.downloadFile(filename);
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader(
                "Content-Disposition",
                contentDisposition ?? `attachment; filename="${filename}"`
            );
            res.status(200).send(Buffer.from(buffer));
        } catch (error: unknown) {
            const err = error as { status?: number; message?: string; data?: unknown };
            console.error("Exports downloadFile error:", err);
            if (err.status === 404) {
                return res.status(404).json({ detail: "File not found" });
            }
            if (err.status === 400) {
                return res.status(400).json({ detail: err.message ?? "Bad request" });
            }
            res.status(500).json({ detail: err.message ?? "Internal server error" });
        }
    }

    static async directDownload(req: Request, res: Response) {
        try {
            const predicted_by = queryParam(req.query.predicted_by);
            const prediction_type = queryParam(req.query.prediction_type);
            const prediction_provider = queryParam(req.query.prediction_provider);
            const start_date = queryParam(req.query.start_date);
            const end_date = queryParam(req.query.end_date);
            const max_rows = req.query.max_rows != null ? Number(req.query.max_rows) : undefined;

            if (!predicted_by || !prediction_type || !prediction_provider || !start_date || !end_date) {
                return res.status(400).json({
                    detail: "predicted_by, prediction_type, prediction_provider, start_date, end_date are required",
                });
            }
            const params: {
                predicted_by: string;
                prediction_type: string;
                prediction_provider: string;
                start_date: string;
                end_date: string;
                max_rows?: number;
            } = {
                predicted_by,
                prediction_type,
                prediction_provider,
                start_date,
                end_date,
            };
            if (max_rows != null && !Number.isNaN(max_rows)) params.max_rows = max_rows;
            const { buffer, contentDisposition } = await ExportsService.directDownload(params);
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader(
                "Content-Disposition",
                contentDisposition ?? 'attachment; filename="export.csv"'
            );
            res.status(200).send(Buffer.from(buffer));
        } catch (error: unknown) {
            const err = error as { status?: number; message?: string };
            console.error("Exports directDownload error:", err);
            if (err.status === 400) {
                return res.status(400).json({ detail: err.message ?? "Bad request" });
            }
            res.status(500).json({ detail: err.message ?? "Internal server error" });
        }
    }

    static async postExport(req: Request, res: Response) {
        try {
            const predicted_by = queryParam(req.query.predicted_by);
            const prediction_type = queryParam(req.query.prediction_type);
            const prediction_provider = queryParam(req.query.prediction_provider);
            const start_date = queryParam(req.query.start_date);
            const end_date = queryParam(req.query.end_date);

            if (!predicted_by || !prediction_type || !prediction_provider || !start_date || !end_date) {
                return res.status(400).json({
                    detail: "predicted_by, prediction_type, prediction_provider, start_date, end_date are required",
                });
            }
            const result = await ExportsService.postExportAsync({
                predicted_by,
                prediction_type,
                prediction_provider,
                start_date,
                end_date,
            });
            res.status(202).json(result);
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: unknown }; message?: string };
            console.error("Exports postExport error:", err);
            if (err.response) {
                return res
                    .status(err.response.status)
                    .json(err.response.data ?? { detail: "Error from exports API" });
            }
            res.status(500).json({ detail: err.message ?? "Internal server error" });
        }
    }
}
