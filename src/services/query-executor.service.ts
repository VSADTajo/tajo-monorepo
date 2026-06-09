import Log from '../collections/log.collection';
import Forecast from '../collections/forecast.collection';
import { DataSource } from '../types/alert.types';
import { getPool } from '../config/datasources';

export class QueryExecutorService {
    static async execute(dataSource: DataSource, query: string): Promise<{ result: number; durationMs: number }> {
        const start = Date.now();

        if (dataSource === DataSource.MONGODB_LOCAL) {
            const result = await QueryExecutorService.executeMongoQuery(query);
            return { result, durationMs: Date.now() - start };
        }

        const result = await QueryExecutorService.executePgQuery(dataSource, query);
        return { result, durationMs: Date.now() - start };
    }

    static async executeMongoQuery(queryJson: string): Promise<number> {
        const parsed = JSON.parse(queryJson);

        // Support specifying collection: { collection: "logs"|"forecasts", filter: {...} }
        const collection = parsed.collection ?? 'logs';
        const filter = parsed.filter ?? parsed;

        // Convert date strings in filter to Date objects
        const processedFilter = QueryExecutorService.processDateFilters(filter);

        if (collection === 'forecasts') {
            return await Forecast.countDocuments(processedFilter);
        }

        return await Log.countDocuments(processedFilter);
    }

    static async executePgQuery(dataSource: DataSource, sql: string): Promise<number> {
        const pool = getPool(dataSource);
        const client = await pool.connect();

        try {
            // Set statement timeout to 30 seconds
            await client.query('SET statement_timeout = 30000');
            const result = await client.query(sql);

            if (result.rows.length === 0) {
                return 0;
            }

            // Extract first column of first row as number
            const firstRow = result.rows[0] as Record<string, unknown>;
            const keys = Object.keys(firstRow);
            const firstKey = keys[0] as string;
            const value = Number(firstRow[firstKey]);

            return isNaN(value) ? 0 : value;
        } finally {
            client.release();
        }
    }

    private static processDateFilters(filter: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};

        for (const [key, value] of Object.entries(filter)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const processed: Record<string, any> = {};
                for (const [op, val] of Object.entries(value)) {
                    if (typeof val === 'string' && val.startsWith('$NOW')) {
                        processed[op] = QueryExecutorService.parseRelativeDate(val);
                    } else {
                        processed[op] = val;
                    }
                }
                result[key] = processed;
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Parse relative date expressions like:
     * $NOW - minutes offset from current time
     * $NOW-120 means 120 minutes ago
     * $NOW-60 means 60 minutes ago
     */
    private static parseRelativeDate(expression: string): Date {
        const match = expression.match(/^\$NOW(?:-(\d+))?$/);
        if (!match) {
            return new Date();
        }

        const minutesAgo = match[1] ? parseInt(match[1], 10) : 0;
        return new Date(Date.now() - minutesAgo * 60 * 1000);
    }
}
