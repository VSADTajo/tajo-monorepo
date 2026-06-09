import { Pool } from 'pg';
import { DataSource } from '../types/alert.types';

const pools: Map<string, Pool> = new Map();

interface DataSourceConfig {
    id: DataSource;
    name: string;
    envVar: string;
}

const PG_DATASOURCES: DataSourceConfig[] = [
    { id: DataSource.PG_PREDICTIONS, name: 'PostgreSQL Predictions', envVar: 'PG_PREDICTIONS_URL' },
    { id: DataSource.PG_HYDRO, name: 'PostgreSQL Hydro', envVar: 'PG_HYDRO_URL' },
    { id: DataSource.PG_MODEL, name: 'PostgreSQL Model', envVar: 'PG_MODEL_URL' },
    { id: DataSource.PG_NOTIFICATIONS, name: 'PostgreSQL Notifications', envVar: 'PG_NOTIFICATIONS_URL' },
    { id: DataSource.PG_METEO, name: 'PostgreSQL Meteo', envVar: 'PG_METEO_URL' },
    { id: DataSource.PG_USER, name: 'PostgreSQL User', envVar: 'PG_USER_URL' },
    { id: DataSource.PG_SFTP, name: 'PostgreSQL SFTP', envVar: 'PG_SFTP_URL' },
];

export function getPool(dataSource: DataSource): Pool {
    if (pools.has(dataSource)) {
        return pools.get(dataSource)!;
    }

    const config = PG_DATASOURCES.find((ds) => ds.id === dataSource);
    if (!config) {
        throw new Error(`Unknown PostgreSQL data source: ${dataSource}`);
    }

    const connectionString = process.env[config.envVar];
    if (!connectionString) {
        throw new Error(`Environment variable ${config.envVar} is not configured`);
    }

    const pool = new Pool({
        connectionString,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    // Set read-only mode on each new client
    pool.on('connect', (client) => {
        client.query('SET default_transaction_read_only = true').catch((err: Error) => {
            console.error(`Failed to set read-only mode on ${dataSource}:`, err.message);
        });
    });

    pools.set(dataSource, pool);
    return pool;
}

export function getDataSourceName(dataSource: DataSource): string {
    if (dataSource === DataSource.MONGODB_LOCAL) {
        return 'MongoDB (Logs & Forecasts)';
    }
    const config = PG_DATASOURCES.find((ds) => ds.id === dataSource);
    return config?.name ?? dataSource;
}

export async function checkDataSourceStatus(dataSource: DataSource): Promise<'connected' | 'disconnected'> {
    if (dataSource === DataSource.MONGODB_LOCAL) {
        return 'connected'; // Mongoose connection is managed globally
    }

    try {
        const pool = getPool(dataSource);
        const client = await pool.connect();
        client.release();
        return 'connected';
    } catch {
        return 'disconnected';
    }
}

export function getAllDataSources(): { id: DataSource; name: string }[] {
    return [
        { id: DataSource.MONGODB_LOCAL, name: 'MongoDB (Logs & Forecasts)' },
        ...PG_DATASOURCES.map((ds) => ({ id: ds.id, name: ds.name })),
    ];
}

export async function shutdownPools(): Promise<void> {
    for (const pool of pools.values()) {
        await pool.end();
    }
    pools.clear();
}
