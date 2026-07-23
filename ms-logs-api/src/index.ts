import * as dotenv from "dotenv";
import app from "./app";
import { startCleanupCron } from "./crons/cleanup.cron";
import { connectMongoDB } from "./db/db";
import { RabbitMQService } from "./services/rabbitmq.service";
import { AlertEngineService } from "./services/alert-engine.service";

dotenv.config();

const PORT = process.env.PORT || 3000;

async function main() {
    try {
        await connectMongoDB();

        startCleanupCron();

        // Connect to RabbitMQ for alert notifications + webhook fan-out
        try {
            await RabbitMQService.connect();
            // Subscribe to simulation events and dispatch outbound webhooks to subscribers
            await RabbitMQService.consumeSimulationEvents();
        } catch (error) {
            console.error("RabbitMQ connection failed (alerts will retry on dispatch, webhooks disabled until reconnect):", error);
        }

        // Start the alert engine (loads enabled rules and registers crons)
        await AlertEngineService.start();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Error starting server:", error);
        process.exit(1);
    }
}

main();