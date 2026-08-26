import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { WiskiApiProviderService } from './wiski-api-provider.service';
import { WiskiApiConfigService } from '@config/wiski-api/wiski-api-config.service';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { ProviderError } from '@domain/errors/provider.error';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

const BASE_URL = 'https://apisaih.saihchtajo.es';

function buildConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return new ProviderConfig({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'WISKI Observados',
        type: 'WISKI_API',
        baseUrl: BASE_URL,
        pollingIntervalMinutes: 60,
        isActive: true,
        settings: { endpointPath: '/wiski/tagus_flowcast_observado/' },
        ...overrides,
    });
}

function buildConfigService(overrides: Partial<WiskiApiConfigService> = {}): WiskiApiConfigService {
    return {
        baseUrl: '',
        path: '/wiski/tagus_flowcast_observado/',
        timezone: 'Europe/Madrid',
        requestTimeoutMs: 5000,
        maxResponseBytes: 1024 * 1024,
        username: '',
        password: '',
        mockBaseUrl: 'http://127.0.0.1:3008',
        ...overrides,
    } as unknown as WiskiApiConfigService;
}

function buildService(configService = buildConfigService()): WiskiApiProviderService {
    return new WiskiApiProviderService(mockLogger, configService);
}

const PAYLOAD = [
    { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:00:00', value: 20.68 },
    { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T13:45:00', value: 20.67 },
];

describe('WiskiApiProviderService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches the endpoint and maps the readings into normalized series', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: PAYLOAD });

        const series = await buildService().fetch(buildConfig());

        expect(mockedAxios.get).toHaveBeenCalledWith(
            `${BASE_URL}/wiski/tagus_flowcast_observado/`,
            expect.objectContaining({ responseType: 'json' }),
        );
        expect(series).toHaveLength(1);
        expect(series[0].locationId).toBe('E_08');
        expect(series[0].parameterId).toBe('VICT01.historical');
        expect(series[0].units).toBe('Hm3');
        expect(series[0].events).toHaveLength(2);
    });

    it('passes settings.queryParams through, so an unknown filter is a config change', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: PAYLOAD });

        await buildService().fetch(buildConfig({ settings: { queryParams: { ultimas_horas: 48 } } }));

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ params: { ultimas_horas: '48' } }),
        );
    });

    it('falls back to the configured base url when the provider row has none', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: PAYLOAD });

        await buildService(buildConfigService({ baseUrl: 'http://fallback' })).fetch(buildConfig({ baseUrl: '' }));

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'http://fallback/wiski/tagus_flowcast_observado/',
            expect.any(Object),
        );
    });

    it('fails with the reason and never calls out when no base url is configured', async () => {
        await expect(buildService().fetch(buildConfig({ baseUrl: '' }))).rejects.toThrow(ProviderError);

        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('rejects a payload that is not an array instead of ingesting nothing quietly', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { error: 'nope' } });

        await expect(buildService().fetch(buildConfig())).rejects.toThrow(ProviderError);
    });

    it('turns a transport failure into a ProviderError', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND apisaih.saihchtajo.es'));

        await expect(buildService().fetch(buildConfig())).rejects.toThrow(/ENOTFOUND/);
    });

    it('returns no series for an empty answer', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [] });

        await expect(buildService().fetch(buildConfig())).resolves.toEqual([]);
    });


});
