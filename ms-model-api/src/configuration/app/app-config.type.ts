export enum ENVIRONMENT {
    LOCAL = 'local',
    DEVELOPMENT = 'development',
    TEST = 'test',
    PRODUCTION = 'production',
}

export enum LOG_LEVEL {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
    TRACE = 'trace',
}

/** Where the v.obs series of a manual simulation are read from. */
export enum VOBS_SOURCE {
    /** The WISKI CSV export that arrives on the SFTP. */
    SFTP_CSV = 'SFTP_CSV',
    /** Their WISKI REST endpoint, through the same catalog the ingestion uses. */
    WISKI_API = 'WISKI_API',
}

export type AppConfig = {
    nodeEnv: string;
    name: string;
    url: string;
    port: number;
    apiPrefix: string;
    logLevel: string;
    logsApiUrl: string;
    xApiKey: string;
    useCalculatorPipeline: boolean;
    vobsCsvSftpPath: string;
    vobsCsvTimezone: string;
    vobsCsvFetchTimeoutMs: number;
    vobsSource: string;
    mockModelOutputSftpPath: string;
};
