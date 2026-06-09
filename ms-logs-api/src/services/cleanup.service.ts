import fs from "fs";
import path from "path";
import Log from "../collections/log.collection";
import Forecast from "../collections/forecast.collection";

export class CleanupService {
    private static readonly DAYS_TO_KEEP_LOGS = 5;
    private static readonly DAYS_TO_KEEP_FORECASTS = 7;
    private static readonly HOURS_TO_KEEP_FILES = 24;
    private static readonly FILES_DIR = path.join(__dirname, "../../dist/files_results");

    static async cleanupOldFiles(): Promise<number> {
        let deletedCount = 0;

        try {
            if (!fs.existsSync(this.FILES_DIR)) {
                return 0;
            }

            const files = fs.readdirSync(this.FILES_DIR);
            const now = Date.now();
            const twentyFourHoursAgo = now - (this.HOURS_TO_KEEP_FILES * 60 * 60 * 1000);

            for (const file of files) {
                if (file === ".gitkeep") continue;

                const filePath = path.join(this.FILES_DIR, file);
                const stats = fs.statSync(filePath);

                if (stats.mtimeMs < twentyFourHoursAgo) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`Deleted old file: ${file}`);
                }
            }
        } catch (error) {
            console.error("Error cleaning up old files:", error);
        }

        return deletedCount;
    }

    static async cleanupOldLogs(): Promise<number> {
        try {
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - this.DAYS_TO_KEEP_LOGS);

            const result = await Log.deleteMany({
                createdAt: { $lt: fiveDaysAgo }
            });

            console.log(`Deleted ${result.deletedCount} old logs`);
            return result.deletedCount;
        } catch (error) {
            console.error("Error cleaning up old logs:", error);
            return 0;
        }
    }

    static async cleanupOldForecasts(): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.DAYS_TO_KEEP_FORECASTS);

            const result = await Forecast.deleteMany({
                createdAt: { $lt: cutoffDate }
            });

            console.log(`Deleted ${result.deletedCount} old forecasts`);
            return result.deletedCount;
        } catch (error) {
            console.error("Error cleaning up old forecasts:", error);
            return 0;
        }
    }

    static async cleanup(): Promise<void> {
        console.log(`Starting cleanup - removing files older than ${this.HOURS_TO_KEEP_FILES} hours, logs older than ${this.DAYS_TO_KEEP_LOGS} days, and forecasts older than ${this.DAYS_TO_KEEP_FORECASTS} days`);

        const filesDeleted = await this.cleanupOldFiles();
        const logsDeleted = await this.cleanupOldLogs();
        const forecastsDeleted = await this.cleanupOldForecasts();

        console.log(`Cleanup completed: ${filesDeleted} files, ${logsDeleted} logs, and ${forecastsDeleted} forecasts deleted`);
    }
}

