import mongoose from "mongoose";
import Log from "../collections/log.collection";
import { connectMongoDB } from "../db/db";
import { LogLevel } from "../types/log.types";

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly [T, ...T[]]): T {
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx] as T;
}

function buildMessage(entity: string, i: number, level: LogLevel) {
    const payload = {
        entity,
        level,
        index: i,
        correlationId: `seed-${entity}-${i}-${randomBetween(1000, 9999)}`,
        details: {
            stage: pick(["ingest", "validate", "transform", "inference", "dispatch"] as const),
            region: pick(["us-east-1", "eu-west-1", "sa-east-1"] as const),
            latencyMs: randomBetween(10, 3000),
            attempts: randomBetween(1, 3)
        }
    };
    return JSON.stringify(payload);
}

async function main() {
    const entities = [
        "Predictions",
        "PredictionsResults",
        "Notifications",
        "Stations"
    ] as const;

    const perEntity = 100;
    const levels = [LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR] as const;
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    await connectMongoDB();

    for (const entity of entities) {
        const docs = Array.from({ length: perEntity }).map((_, i) => {
            const createdAt = new Date(now - randomBetween(0, threeDaysMs));
            const level = pick(levels);
            return {
                entity,
                level,
                message: buildMessage(entity, i + 1, level),
                meta: { seed: true },
                createdAt
            };
        });

        await Log.insertMany(docs);
        console.log(`Inserted ${docs.length} logs for entity: ${entity}`);
    }

    await mongoose.connection.close();
    console.log("Seed complete");
}

main().catch(err => {
    console.error("Seed failed", err);
    process.exit(1);
});


