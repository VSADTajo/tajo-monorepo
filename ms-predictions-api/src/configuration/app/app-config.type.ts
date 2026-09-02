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
    logsApiUrl: string;
    xApiKey: string;
    /**
     * Header values of the manual-simulation input file, as FEWS must receive
     * them for the import to map the series. Set by Idrica for the CH Tajo
     * instance; configurable so a change on their side is an env change here.
     */
    manualSimulationModuleInstanceId: string;
    manualSimulationParameterId: string;
};
