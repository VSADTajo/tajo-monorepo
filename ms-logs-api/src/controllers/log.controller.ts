import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { LogService } from "../services/log.service";
import { LogLevel } from "../types/log.types";

export class LogController {

    static async createLog(req: Request, res: Response) {
        try {
            const { level, message, source, meta, entity, correlationId } = req.body;
            const file = req.file;

            let parsedMeta = {};
            if (meta) {
                if (typeof meta === 'string') {
                    try {
                        parsedMeta = JSON.parse(meta);
                    } catch {
                        parsedMeta = {};
                    }
                } else {
                    parsedMeta = meta;
                }
            }

            let fileUrl = null;
            let savedFilePath = null;

            if (file) {
                const FILES_DIR = path.join(__dirname, "../../dist/files_results");
                if (!fs.existsSync(FILES_DIR)) {
                    fs.mkdirSync(FILES_DIR, { recursive: true });
                }
                const timestamp = Date.now();
                const fileName = `${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
                const filePath = path.join(FILES_DIR, fileName);
                fs.writeFileSync(filePath, file.buffer);
                fileUrl = `${req.protocol}://${req.get("host")}/files/${fileName}`;
                savedFilePath = `/files/${fileName}`;
            }

            const finalMeta = fileUrl 
                ? `File upload successfully. ${entity}. ${fileUrl}`
                : parsedMeta;

            const newLog = await LogService.createLog({
                level,
                message,
                source,
                meta: finalMeta,
                entity,
                filePath: savedFilePath,
                correlationId: correlationId ?? null,
            });

            res.status(201).json(newLog);
        } catch (error) {
            console.error("Error in createLog:", error);
            res.status(500).json({ message: "Internal server error in createLog" });
        }
    }


    static async getLogs(req: Request, res: Response) {
        try {
            const logs = await LogService.getLogs();
            res.status(200).json(logs);
        } catch (error) {
            res.status(500).json({ message: "Internal server error in getLogs" });
        }
    }

    static async getLogsFiltered(req: Request, res: Response) {
        try {
            const { entity, level, dateFrom, dateTo, correlationId } = req.query as {
                entity?: string;
                level?: keyof typeof LogLevel | LogLevel;
                dateFrom?: string;
                dateTo?: string;
                correlationId?: string;
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

            if (level && !Object.values(LogLevel).includes(level as LogLevel)) {
                return res.status(400).json({ message: "Invalid level. Allowed: info, warning, error" });
            }

            const params: { entity?: string; level?: LogLevel; fromDate?: Date; toDate?: Date; correlationId?: string } = {};
            if (entity !== undefined) params.entity = entity;
            if (level !== undefined) params.level = level as LogLevel;
            if (fromDate !== undefined) params.fromDate = fromDate;
            if (toDate !== undefined) params.toDate = toDate;
            if (correlationId !== undefined) params.correlationId = correlationId;

            const logs = await LogService.getLogsFiltered(params);
            res.status(200).json(logs);
        } catch (error) {
            res.status(500).json({ message: "Internal server error in getLogsFiltered" });
        }
    }

    static async getTotalCount(req: Request, res: Response) {
        try {
            const count = await LogService.getTotalCount();
            res.status(200).json({ count });
        } catch (error) {
            res.status(500).json({ message: "Internal server error in getTotalCount" });
        }
    }

    static async getCountByEntity(req: Request, res: Response) {
        try {
            const entity = typeof req.params.entity === "string" ? req.params.entity : req.params.entity?.[0];
            if (!entity) {
                return res.status(400).json({ message: "Entity parameter is required" });
            }
            const count = await LogService.getCountByEntity(entity);
            res.status(200).json({ count });
        } catch (error) {
            res.status(500).json({ message: "Internal server error in getCountByEntity" });
        }
    }

    static async getAllEntities(req: Request, res: Response) {
        try {
            const entities = await LogService.getAllEntities();
            res.status(200).json(entities);
        } catch (error) {
            res.status(500).json({ message: "Internal server error in getAllEntities" });
        }
    }
}