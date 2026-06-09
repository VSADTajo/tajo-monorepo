import Log from "../collections/log.collection";
import { LogData, LogLevel } from "../types/log.types";

export class LogService {
    static async createLog(log: LogData) {
        const newLog = await Log.create(log);
        return newLog;
    }

    static async getLogs() {
        const logs = await Log.find();
        return logs;
    }

    static async getLogsFiltered(params: { entity?: string; level?: LogLevel; fromDate?: Date; toDate?: Date; correlationId?: string }) {
        const { entity, level, fromDate, toDate, correlationId } = params;
        const filter: Record<string, any> = {};

        if (entity) {
            filter.entity = entity;
        }

        if (level) {
            filter.level = level;
        }

        if (correlationId) {
            filter.correlationId = correlationId;
        }

        if (fromDate || toDate) {
            filter.createdAt = {} as any;
            if (fromDate) filter.createdAt.$gte = fromDate;
            if (toDate) filter.createdAt.$lte = toDate;
        }

        const logs = await Log.find(filter).sort({ createdAt: -1 });
        return logs;
    }

    static async getTotalCount(): Promise<number> {
        const count = await Log.countDocuments();
        return count;
    }

    static async getCountByEntity(entity: string): Promise<number> {
        const count = await Log.countDocuments({ entity });
        return count;
    }

    static async getAllEntities(): Promise<string[]> {
        const entities = await Log.distinct('entity');
        return entities.sort();
    }
}