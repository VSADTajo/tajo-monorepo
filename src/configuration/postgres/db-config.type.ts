import { DatabaseType } from 'typeorm';

export type DbConfig = {
    type: DatabaseType;
    host: string;
    port: number;
    username?: string;
    password?: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
    entities: string[];
    autoLoadEntities: boolean;
    migrations: string[];
    cli: {
        migrationsDir: string;
    };
    ssl?: boolean | { rejectUnauthorized: boolean };
};
