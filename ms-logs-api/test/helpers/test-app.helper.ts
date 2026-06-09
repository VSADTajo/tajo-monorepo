import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../../src/app';
import type { Express } from 'express';

let mongoServer: MongoMemoryServer | null = null;

export async function createTestApp(): Promise<{ app: Express }> {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    return { app };
}

export async function closeTestApp(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
}
