import { ConfigService } from '@nestjs/config';

import { AppConfigService } from './app-config.service';

function makeService(env: Record<string, string | undefined>): AppConfigService {
    const configService = {
        getOrThrow: (key: string) => {
            // Resolve dotted key from the flat env map we provide
            const parts = key.split('.');
            const leaf = parts[parts.length - 1];
            if (leaf in env) return env[leaf];

            // Return defaults for unrelated keys (avoid throwing)
            const defaults: Record<string, unknown> = {
                nodeEnv: 'test',
                name: 'test',
                url: 'http://localhost',
                port: 3000,
                apiPrefix: 'api',
                logLevel: 'info',
                logsApiUrl: '',
                xApiKey: '',
                useCalculatorPipeline: env.useCalculatorPipeline ?? false,
                vobsCsvSftpPath: env.vobsCsvSftpPath ?? '',
                vobsCsvTimezone: env.vobsCsvTimezone ?? 'Europe/Madrid',
                vobsCsvFetchTimeoutMs: env.vobsCsvFetchTimeoutMs ?? 30000,
            };
            if (leaf in defaults) return defaults[leaf];
            throw new Error(`Config key not found: ${key}`);
        },
    } as unknown as ConfigService;

    return new AppConfigService(configService);
}

describe('AppConfigService — calculator pipeline config', () => {
    it('should return true for useCalculatorPipeline when env is "true"', () => {
        const svc = makeService({ useCalculatorPipeline: true as unknown as string });
        expect(svc.useCalculatorPipeline).toBe(true);
    });

    it('should return false for useCalculatorPipeline when env is "false"', () => {
        const svc = makeService({ useCalculatorPipeline: false as unknown as string });
        expect(svc.useCalculatorPipeline).toBe(false);
    });

    it('should return false for useCalculatorPipeline when env is undefined', () => {
        const svc = makeService({});
        expect(svc.useCalculatorPipeline).toBe(false);
    });

    it('should return empty string for vobsCsvSftpPath by default', () => {
        const svc = makeService({});
        expect(svc.vobsCsvSftpPath).toBe('');
    });

    it('should return configured path for vobsCsvSftpPath', () => {
        const svc = makeService({ vobsCsvSftpPath: '/simulations/wiski/Tagus_FlowCast.csv' });
        expect(svc.vobsCsvSftpPath).toBe('/simulations/wiski/Tagus_FlowCast.csv');
    });

    it('should return Europe/Madrid for vobsCsvTimezone by default', () => {
        const svc = makeService({});
        expect(svc.vobsCsvTimezone).toBe('Europe/Madrid');
    });

    it('should return configured timezone for vobsCsvTimezone', () => {
        const svc = makeService({ vobsCsvTimezone: 'UTC' });
        expect(svc.vobsCsvTimezone).toBe('UTC');
    });

    it('should return 30000 for vobsCsvFetchTimeoutMs by default', () => {
        const svc = makeService({});
        expect(svc.vobsCsvFetchTimeoutMs).toBe(30000);
    });

    it('should return configured timeout for vobsCsvFetchTimeoutMs', () => {
        const svc = makeService({ vobsCsvFetchTimeoutMs: 10000 as unknown as string });
        expect(svc.vobsCsvFetchTimeoutMs).toBe(10000);
    });
});
