import cron from "node-cron";
import { CleanupService } from "../services/cleanup.service";

export function startCleanupCron() {
    // Ejecutar todos los días a las 2:00 AM
    cron.schedule("0 2 * * *", async () => {
        console.log("Running scheduled cleanup job...");
        await CleanupService.cleanup();
    });

    console.log("Cleanup cron job scheduled: Daily at 2:00 AM");
}

