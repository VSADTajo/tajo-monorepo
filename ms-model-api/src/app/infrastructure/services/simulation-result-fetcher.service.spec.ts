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
