import mongoose from 'mongoose';

export async function cleanDatabase(): Promise<void> {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
}
