import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { FewsApiProviderService, buildQueryParams, buildQueryWindow, toIdList } from './fews-api-provider.service';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
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

const BASE_URL = 'http://cpdfews2.saihchtajo.es:8080/FewsWebServices';
const NOW = new Date('2026-07-29T11:45:30Z');

/** A real-shaped PI-JSON answer: one modelled series, one FEWS never filled. */
const PI_JSON = {
    version: '1.34',
    timeZone: '0.0',
    timeSeries: [
        {
            header: {
                type: 'instantaneous',
                moduleInstanceId: 'EnsembleStat_EPS_NAM_Jar',
                locationId: 'AR01',
                parameterId: 'Q.NAM.ens.Med',
                timeStep: { unit: 'hour', multiplier: '1' },
                startDate: { date: '2026-07-29', time: '11:00:00' },
                endDate: { date: '2026-07-29', time: '12:00:00' },
                forecastDate: { date: '2026-07-29', time: '00:00:00' },
                missVal: '-999.0',
                stationName: 'Aranjuez',
                units: 'm3/s',
            },
            events: [
                { date: '2026-07-29', time: '11:00:00', value: '12.3', flag: '0' },
                { date: '2026-07-29', time: '12:00:00', value: '12.9', flag: '0' },
            ],
        },
        {
            header: {
                type: 'instantaneous',
                locationId: 'AR02',
                parameterId: 'Q.NAM.ens.Med',
                timeStep: { unit: 'hour', multiplier: '1' },
                startDate: { date: '2026-07-29', time: '11:00:00' },
                endDate: { date: '2026-07-29', time: '12:00:00' },
                missVal: '-999.0',
                units: 'm3/s',
            },
            events: [
                { date: '2026-07-29', time: '11:00:00', value: '-999.0', flag: '8' },
                { date: '2026-07-29', time: '12:00:00', value: '-999', flag: '8' },
            ],
        },
    ],
};

function buildConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return new ProviderConfig({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'FEWS EPS Caudal',
        type: 'FEWS_API',
        baseUrl: BASE_URL,
        pollingIntervalMinutes: 60,
        isActive: true,
        settings: {
            filterId: 'Tajo_API',
            parameterIds: 'Q.NAM.ens.Med, Q.NAM.ens.90',
            horizonDays: 6,
        },
        ...overrides,
    });
}

function buildConfigService(overrides: Partial<FewsApiConfigService> = {}): FewsApiConfigService {
    return {
        baseUrl: '',
        servicePath: '/rest/fewspiservice/v1',
        requestTimeoutMs: 5000,
        username: '',
        password: '',
        ...overrides,
    } as unknown as FewsApiConfigService;
}

function buildService(configService = buildConfigService()): FewsApiProviderService {
    return new FewsApiProviderService(mockLogger, configService);
}

function lastRequest(): { url: string; params: URLSearchParams; options: Record<string, unknown> } {
    const [url, options] = (mockedAxios.get as jest.Mock).mock.calls[0];
    return { url, params: options.params as URLSearchParams, options };
}

describe('toIdList()', () => {
    it('splits a comma-separated string and trims blanks', () => {
        expect(toIdList(' A, B ,,C ')).toEqual(['A', 'B', 'C']);
    });

    it('passes an array through', () => {
        expect(toIdList(['A', ' B '])).toEqual(['A', 'B']);
    });

    it('returns nothing for anything else', () => {
        expect(toIdList(undefined)).toEqual([]);
        expect(toIdList(42)).toEqual([]);
    });
});

describe('buildQueryWindow()', () => {
    it('anchors on the :00 before now and looks horizonDays ahead', () => {
        const window = buildQueryWindow(NOW, { horizonDays: 6 });

        expect(window?.startTime.toISOString()).toBe('2026-07-29T11:00:00.000Z');
        expect(window?.endTime.toISOString()).toBe('2026-08-04T11:00:00.000Z');
    });

    it('looks lookbackDays behind for observed data', () => {
        const window = buildQueryWindow(NOW, { lookbackDays: 3 });

        expect(window?.startTime.toISOString()).toBe('2026-07-26T11:00:00.000Z');
        expect(window?.endTime.toISOString()).toBe('2026-07-29T11:00:00.000Z');
    });

    it('accepts the numbers as strings, which is how the backoffice form stores them', () => {
        const window = buildQueryWindow(NOW, { horizonDays: '3', lookbackDays: '0' });

        expect(window?.endTime.toISOString()).toBe('2026-08-01T11:00:00.000Z');
    });

    it('returns null when no window was declared', () => {
        expect(buildQueryWindow(NOW, {})).toBeNull();
    });
});

describe('buildQueryParams()', () => {
    it('repeats parameterIds and locationIds per value, as the service expects', () => {
        const params = buildQueryParams(
            { filterId: 'Tajo_API', parameterIds: 'Q.NAM.ens.Med,Q.NAM.ens.90', locationIds: ['AR01', 'AR02'] },
            null,
        );

        expect(params.toString()).toBe(
            'documentFormat=PI_JSON&filterId=Tajo_API&parameterIds=Q.NAM.ens.Med&parameterIds=Q.NAM.ens.90' +
                '&locationIds=AR01&locationIds=AR02',
        );
    });

    it('formats the window as FEWS times and adds ensembleId only when set', () => {
        const window = buildQueryWindow(NOW, { horizonDays: 5 })!;
        const params = buildQueryParams(
            { filterId: 'Tajo_API', parameterIds: 'Q.minerve', ensembleId: 'RSMinerve_cases' },
            window,
        );

        expect(params.get('startTime')).toBe('2026-07-29T11:00:00Z');
        expect(params.get('endTime')).toBe('2026-08-03T11:00:00Z');
        expect(params.get('ensembleId')).toBe('RSMinerve_cases');
        expect(buildQueryParams({ filterId: 'x' }, null).has('ensembleId')).toBe(false);
    });
});

describe('FewsApiProviderService.fetch()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(NOW);
        mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: PI_JSON });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('calls the timeseries endpoint of the provider base url with the documented query', async () => {
        await buildService().fetch(buildConfig());

        const { url, params } = lastRequest();
        expect(url).toBe(`${BASE_URL}/rest/fewspiservice/v1/timeseries`);
        expect(params.toString()).toBe(
            'documentFormat=PI_JSON&filterId=Tajo_API&parameterIds=Q.NAM.ens.Med&parameterIds=Q.NAM.ens.90' +
                '&startTime=2026-07-29T11%3A00%3A00Z&endTime=2026-08-04T11%3A00%3A00Z',
        );
    });

    it('maps the answer with the tolerant PI-JSON mapper, dropping series FEWS never filled', async () => {
        const series = await buildService().fetch(buildConfig());

        expect(series).toHaveLength(1);
        expect(series[0]).toMatchObject({
            locationId: 'AR01',
            parameterId: 'Q.NAM.ens.Med',
            moduleInstanceId: 'EnsembleStat_EPS_NAM_Jar',
            forecastDate: '2026-07-29T00:00:00Z',
        });
        expect(series[0].events).toHaveLength(2);
    });

    it('falls back to the configured base url and service path when the provider sets none', async () => {
        const configService = buildConfigService({ baseUrl: 'http://fews.local/', servicePath: '/custom/v1/' });

        await buildService(configService).fetch(buildConfig({ baseUrl: '' }));

        expect(lastRequest().url).toBe('http://fews.local/custom/v1/timeseries');
    });

    it('fails with the reason when no base url is known at all', async () => {
        await expect(buildService().fetch(buildConfig({ baseUrl: '' }))).rejects.toBeInstanceOf(ProviderError);
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('sends basic auth only when credentials are configured', async () => {
        await buildService(buildConfigService({ username: 'u', password: 'p' })).fetch(buildConfig());
        expect(lastRequest().options.auth).toEqual({ username: 'u', password: 'p' });

        jest.clearAllMocks();
        mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: PI_JSON });
        await buildService().fetch(buildConfig());
        expect(lastRequest().options.auth).toBeUndefined();
    });

    it('refuses a 206 instead of ingesting a partial answer', async () => {
        mockedAxios.get = jest.fn().mockResolvedValue({ status: 206, data: PI_JSON });

        await expect(buildService().fetch(buildConfig())).rejects.toThrow(/206/);
    });

    it('wraps transport errors as ProviderError', async () => {
        mockedAxios.get = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(buildService().fetch(buildConfig())).rejects.toThrow(/ECONNREFUSED/);
    });
});
