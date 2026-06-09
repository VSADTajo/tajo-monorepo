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

export type AppConfig = {
    nodeEnv: string;
    name: string;
    url: string;
    port: number;
    apiPrefix: string;
    logLevel: string;
    /** * = permitir todo; en producción: URL(s) o IP(s) del servicio que puede llamar, separados por coma */
    allowedOrigins: string;
    /** Lista de IP:PUERTO permitidos. '*' = todos. Varios separados por coma. */
    allowedClients: string;
    logsApiUrl: string;
    xApiKey: string;
};
