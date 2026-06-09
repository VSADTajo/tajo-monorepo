export type RetentionMode = 'days' | 'today';

export type MeteoConfig = {
    sftpApiUrl: string;
    sftpApiInternalCaller: string;
    meteoBasePath: string;
    geoserverUrl: string;
    geoserverUser: string;
    geoserverPassword: string;
    geoserverWorkspace: string;
    geoserverDbHost: string;
    geoserverDbPort: number;
    geoserverDbDatabase: string;
    geoserverDbUsername: string;
    geoserverDbPassword: string;
    meteoGeotiffDir: string;
    meteoSyncCron: string;
    meteoRetentionCron: string;
    meteoRetentionDays: number;
    meteoRetentionMode: RetentionMode;
    meteoIngestConcurrency: number;
    aemetApiKey: string;
    aemetBaseUrl: string;
    aemetDefaultArea: string;
};
