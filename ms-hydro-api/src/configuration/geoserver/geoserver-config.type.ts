import { DatabaseType } from 'typeorm';

export type GeoserverDbConfig = {
    type: DatabaseType;
    host: string;
    port: number;
    username?: string;
    password?: string;
    database: string;
};
