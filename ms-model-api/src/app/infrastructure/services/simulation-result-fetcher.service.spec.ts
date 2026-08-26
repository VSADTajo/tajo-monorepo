import axios from 'axios';

import { Logger } from 'nestjs-pino';

import { SimulationResultFetcherService } from './simulation-result-fetcher.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { WiskiTimeSeriesResult } from '@domain/results/wiski-timeseries.result';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

function buildService(overrides: {
    vobsCsvSftpPath?: string;
    vobsCsvTimezone?: string;
    vobsCsvFetchTimeoutMs?: number;
    sftpBaseUrl?: string;
}): SimulationResultFetcherService {
    const sftpApiConfigService = {
        baseUrl: overrides.sftpBaseUrl ?? 'http://sftp-api:3003',
    } as unknown as SftpApiConfigService;

    const appConfigService = {
        vobsCsvSftpPath: overrides.vobsCsvSftpPath ?? '',
        vobsCsvTimezone: overrides.vobsCsvTimezone ?? 'Europe/Madrid',
        vobsCsvFetchTimeoutMs: overrides.vobsCsvFetchTimeoutMs ?? 30000,
    } as unknown as AppConfigService;

    return new SimulationResultFetcherService(mockLogger, sftpApiConfigService, appConfigService);
}

const VALID_WISKI_CSV = `
Número de la estación: E_08
Nombre de la serie temporal: VICT01.Validado
Nombre de la estación: Estación Victoria
Unidad de la serie temporal: m3/s

01/06/2026;10:00:00;12.3
02/06/2026;11:00:00;14.5
`.trim();

describe('SimulationResultFetcherService.fetchVobsSeries()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return null and not call axios when vobsCsvSftpPath is empty', async () => {
        const service = buildService({ vobsCsvSftpPath: '' });
        const result = await service.fetchVobsSeries('sim-111');
        expect(result).toBeNull();
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should return parsed WiskiTimeSeriesResult[] on happy path', async () => {
        const csvBuffer = Buffer.from(VALID_WISKI_CSV, 'utf-8');
        mockedAxios.get = jest.fn().mockResolvedValue({ data: csvBuffer });

        const service = buildService({
            vobsCsvSftpPath: '/simulations/wiski/Tagus_FlowCast.csv',
            vobsCsvTimezone: 'UTC',
        });

        const result = await service.fetchVobsSeries('sim-222');
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect((result as WiskiTimeSeriesResult[]).length).toBeGreaterThan(0);
        // Verify parameterId is verbatim from the CSV header
        expect((result as WiskiTimeSeriesResult[])[0].header.parameterId).toBe('VICT01.Validado');
    });

    it('should pass the configured timeout to axios', async () => {
        const csvBuffer = Buffer.from(VALID_WISKI_CSV, 'utf-8');
        mockedAxios.get = jest.fn().mockResolvedValue({ data: csvBuffer });

        const service = buildService({
            vobsCsvSftpPath: '/simulations/wiski/test.csv',
            vobsCsvFetchTimeoutMs: 15000,
        });

        await service.fetchVobsSeries('sim-333');

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('/files/download'),
            expect.objectContaining({ timeout: 15000 }),
        );
    });

    it('should return null and log a warning when axios rejects (network error)', async () => {
        mockedAxios.get = jest.fn().mockRejectedValue(new Error('Network error'));

        const service = buildService({ vobsCsvSftpPath: '/simulations/wiski/test.csv' });
        const result = await service.fetchVobsSeries('sim-444');

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should return null and log a warning when the CSV buffer cannot be decoded', async () => {
        // Return a non-Buffer data that triggers a decode / parse error
        mockedAxios.get = jest.fn().mockResolvedValue({ data: null });

        const service = buildService({ vobsCsvSftpPath: '/simulations/wiski/test.csv' });
        const result = await service.fetchVobsSeries('sim-555');

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────
// fetchFromFolder
// ─────────────────────────────────────────────────────────────

const OUTPUT_FOLDER = 'tajo/SIMULATIONS/sim-abc/output';
const RESULT_FILE = {
    name: 'tagus_Q_mod_202607271100.json',
    path: `${OUTPUT_FOLDER}/tagus_Q_mod_202607271100.json`,
    isDirectory: false,
};

/**
 * Builds a FEWS PI-JSON series. FEWS only emits the five "execution" fields
 * (forecastDate, moduleInstanceId, creationDate, creationTime, approvedDate)
 * for series a module actually produced — series outside the running model
 * carry none of them and are filled entirely with missVal.
 */
function buildSeries(options: {
    locationId: string;
    parameterId: string;
    withForecastDate: boolean;
    values: string[];
}) {
    const header: Record<string, unknown> = {
        type: 'instantaneous',
        locationId: options.locationId,
        parameterId: options.parameterId,
        timeStep: { unit: 'second', multiplier: '900' },
        startDate: { date: '2026-07-27', time: '11:00:00' },
        endDate: { date: '2026-07-30', time: '11:00:00' },
        missVal: '-999.0',
        stationName: `${options.locationId} STATION`,
        lat: '40.4',
        lon: '-2.7',
        x: '521205.76',
        y: '4482642.75',
        z: '723.0',
        units: 'm3/s',
    };

    if (options.withForecastDate) {
        header.forecastDate = { date: '2026-07-27', time: '09:00:00' };
        header.moduleInstanceId = 'RunMIKE11_Forecast_TajoJar_web';
        header.creationDate = '2026-07-27';
        header.creationTime = '11:14:12';
        header.approvedDate = { date: '2026-07-27', time: '11:18:18' };
    }

    const events = options.values.map((value, index) => ({
        date: '2026-07-27',
        time: `${String(11 + index).padStart(2, '0')}:00:00`,
        value,
        flag: value === '-999.0' ? '8' : '2',
    }));

    return { header, events };
}

// Mirrors the real 27-jul file: a produced series, an unmodelled one with no
// execution metadata at all, and a processed-but-empty one (E_44 / E_65 case).
const PRODUCED_SERIES = buildSeries({
    locationId: 'E_09',
    parameterId: 'Q.mk11.forecast.web',
    withForecastDate: true,
    values: ['5.559', '5.557'],
});
const UNMODELLED_SERIES = buildSeries({
    locationId: 'E_17',
    parameterId: 'I.mk11.forecast.web',
    withForecastDate: false,
    values: ['-999.0', '-999.0'],
});
const PROCESSED_EMPTY_SERIES = buildSeries({
    locationId: 'E_44',
    parameterId: 'Q.salida.forecast',
    withForecastDate: true,
    values: ['-999.0', '-999.0'],
});

function mockSftpResponses(payload: unknown): void {
    mockedAxios.get = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/files/download')) {
            return Promise.resolve({ data: payload });
        }
        return Promise.resolve({ data: { files: [RESULT_FILE] } });
    });
    mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });
}

describe('SimulationResultFetcherService.fetchFromFolder()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should parse a file whose series lack forecastDate instead of treating it as corrupted', async () => {
        mockSftpResponses({ version: '1.34', timeZone: '0.0', timeSeries: [PRODUCED_SERIES, UNMODELLED_SERIES] });

        const service = buildService({});
        const result = await service.fetchFromFolder(OUTPUT_FOLDER);

        expect(result).not.toBeNull();
        const movedToCorrupted = (mockedAxios.post as jest.Mock).mock.calls.some((call) =>
            String(call[1]?.destinationPath).includes('/corrupted/'),
        );
        expect(movedToCorrupted).toBe(false);
    });

    it('should keep only series carrying at least one real value', async () => {
        mockSftpResponses({
            version: '1.34',
            timeZone: '0.0',
            timeSeries: [PRODUCED_SERIES, UNMODELLED_SERIES, PROCESSED_EMPTY_SERIES],
        });

        const service = buildService({});
        const result = await service.fetchFromFolder(OUTPUT_FOLDER);

        expect(result?.timeSeries).toHaveLength(1);
        expect(result?.timeSeries[0].locationId).toBe('E_09');
    });

    it('should report how many empty series were discarded', async () => {
        mockSftpResponses({
            version: '1.34',
            timeZone: '0.0',
            timeSeries: [PRODUCED_SERIES, UNMODELLED_SERIES, PROCESSED_EMPTY_SERIES],
        });

        const service = buildService({});
        const result = await service.fetchFromFolder(OUTPUT_FOLDER);

        expect(result?.skippedEmptySeries).toBe(2);
    });

    it('should move a successfully parsed file to historial/', async () => {
        mockSftpResponses({ version: '1.34', timeZone: '0.0', timeSeries: [PRODUCED_SERIES, UNMODELLED_SERIES] });

        const service = buildService({});
        await service.fetchFromFolder(OUTPUT_FOLDER);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/files/move'),
            expect.objectContaining({ destinationPath: `${OUTPUT_FOLDER}/historial/${RESULT_FILE.name}` }),
            expect.anything(),
        );
    });

    it('should still move a genuinely malformed file to corrupted/', async () => {
        mockSftpResponses({ version: '1.34', timeZone: '0.0' }); // no timeSeries at all

        const service = buildService({});

        await expect(service.fetchFromFolder(OUTPUT_FOLDER)).rejects.toThrow();
        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/files/move'),
            expect.objectContaining({ destinationPath: `${OUTPUT_FOLDER}/corrupted/${RESULT_FILE.name}` }),
            expect.anything(),
        );
    });

    it('should return null when the output folder holds no JSON file yet', async () => {
        mockedAxios.get = jest.fn().mockResolvedValue({ data: { files: [] } });
        mockedAxios.post = jest.fn();

        const service = buildService({});

        await expect(service.fetchFromFolder(OUTPUT_FOLDER)).resolves.toBeNull();
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// v.obs from the WISKI API (VOBS_SOURCE=WISKI_API)
// ─────────────────────────────────────────────────────────────────────────────

describe('SimulationResultFetcherService.fetchVobsSeries() — WISKI_API source', () => {
    const WISKI_READINGS = [
        { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T14:00:00', value: 20.68 },
        { variable: 'E_08VICT01.Validado', lastchange: '2026-08-11T13:45:00', value: 20.67 },
    ];

    function buildWiskiFetcher(overrides: { baseUrl?: string } = {}) {
        const appConfig = {
            vobsSource: 'WISKI_API',
            vobsCsvSftpPath: 'tajo/Tagus_FlowCast.csv',
            vobsCsvTimezone: 'Europe/Madrid',
            vobsCsvFetchTimeoutMs: 5000,
        } as unknown as AppConfigService;

        const wiskiConfig = {
            baseUrl: overrides.baseUrl ?? 'https://apisaih.saihchtajo.es',
            path: '/wiski/tagus_flowcast_observado/',
            timezone: 'Europe/Madrid',
            requestTimeoutMs: 5000,
            maxResponseBytes: 1024 * 1024,
        } as unknown as import('@config/wiski-api/wiski-api-config.service').WiskiApiConfigService;

        return new SimulationResultFetcherService(
            mockLogger,
            { baseUrl: 'http://ms-sftp-api:3003' } as unknown as SftpApiConfigService,
            appConfig,
            wiskiConfig,
        );
    }

    beforeEach(() => jest.clearAllMocks());

    it('reads the endpoint and returns the same shape the CSV path returns', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: WISKI_READINGS });

        const series = await buildWiskiFetcher().fetchVobsSeries('sim-1');

        expect(series).toHaveLength(1);
        expect(series![0].header.locationId).toBe('E_08');
        // Verbatim, exactly as parseWiskiCsv emits it.
        expect(series![0].header.parameterId).toBe('VICT01.Validado');
        expect(series![0].events[0]).toEqual({
            date: '2026-08-11',
            time: '11:45:00',
            value: '20.67',
            flag: '2',
        });
    });

    it('degrades to null when the endpoint is unreachable', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('ENOTFOUND apisaih.saihchtajo.es'));

        await expect(buildWiskiFetcher().fetchVobsSeries('sim-1')).resolves.toBeNull();
    });

    it('degrades to null when the source is selected but no base url is configured', async () => {
        const series = await buildWiskiFetcher({ baseUrl: '' }).fetchVobsSeries('sim-1');

        expect(series).toBeNull();
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });
});
