import { Injectable } from '@nestjs/common';

/**
 * In-process per-dataset mutex used to serialize concurrent sync attempts
 * for the same `(provider, variable)`. The service runs as a single replica
 * today, so an in-process Map is sufficient. If we ever scale to multiple
 * replicas this becomes a Redis lock or a Postgres advisory lock.
 *
 * Usage:
 *   const release = await mutex.acquire(provider, variable);
 *   try { ... } finally { release(); }
 */
@Injectable()
export class DatasetMutex {
    private readonly locks = new Map<string, Promise<void>>();

    private key(provider: string, variable: string | null): string {
        return `${provider}::${variable ?? ''}`;
    }

    /**
     * Attempts to acquire the lock for the given dataset.
     * Returns `null` immediately if the lock is already held (no waiting).
     * Returns a release function if the lock was acquired.
     */
    tryAcquire(provider: string, variable: string | null): (() => void) | null {
        const k = this.key(provider, variable);
        if (this.locks.has(k)) {
            return null;
        }
        let release!: () => void;
        const promise = new Promise<void>((resolve) => {
            release = () => {
                this.locks.delete(k);
                resolve();
            };
        });
        this.locks.set(k, promise);
        return release;
    }
}
