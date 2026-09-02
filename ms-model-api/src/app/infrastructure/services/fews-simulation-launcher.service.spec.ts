import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { FewsSimulationLauncherService, buildRunWindow } from './fews-simulation-launcher.service';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { FewsTaskClientService } from './fews-task-client.service';
import { FewsTargetResolverService } from './fews-target-resolver.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { ProviderError } from '@domain/errors/provider.error';
import { FewsTarget } from '@domain/types/fews-target.type';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

const OUTPUT_FOLDER = 'tajo/SIMULATIONS/sim-1/output';
const INPUT_FOLDER = 'tajo/SIMULATIONS/sim-1/input';

const REAL_TARGET: FewsTarget = {
    baseUrl: 'https://fews.example.org/FewsWebServices',
    servicePath: '/rest/fewspiservice/v1',
    filterId: 'TAJO_WEB',
    workflowId: 'Jarama_Henares_Forecast',
    username: '',
    password: '',
};

const MOCK_TARGET: FewsTarget = {
    ...REAL_TARGET,
    baseUrl: 'http://127.0.0.1:3008',
    servicePath: '/mock-fews/rest/fewspiservice/v1',
};

const mockClient = {
    postTimeSeries: jest.fn(),
    runTask: jest.fn(),
};

const mockResolver = {
    resolve: jest.fn((source: string) => (source === 'MOCK' ? MOCK_TARGET : REAL_TARGET)),
};

function buildService(): FewsSimulationLauncherService {
    const sftpConfig = { baseUrl: 'http://ms-sftp-api:3003' } as unknown as SftpApiConfigService;
    const fewsConfig = { runStartOffsetMinutes: 60, runHorizonDays: 3 } as unknown as FewsApiConfigService;
    return new FewsSimulationLauncherService(
        mockLogger,
        sftpConfig,
        mockClient as unknown as FewsTaskClientService,
        mockResolver as unknown as FewsTargetResolverService,
        fewsConfig,
    );
}

describe('buildRunWindow()', () => {
    it('starts one hour before now, rounded down to the quarter hour, and spans the horizon', () => {
        // Idrica: startTime = execution time minus one hour, minutes at :00/:15/:30/:45.
        const window = buildRunWindow(new Date('2026-07-30T17:52:41Z'), 60, 3);

        expect(window.startTime.toISOString()).toBe('2026-07-30T16:45:00.000Z');
        expect(window.endTime.toISOString()).toBe('2026-08-02T16:45:00.000Z');
    });

    it('keeps an exact quarter hour as is', () => {
        const window = buildRunWindow(new Date('2026-07-30T17:45:00Z'), 60, 3);

        expect(window.startTime.toISOString()).toBe('2026-07-30T16:45:00.000Z');
    });
});

/** input/ holds the generated file; download returns its content. */
function mockSftp(files: { name: string }[], content = '{"timeSeries":[]}'): void {
    mockedAxios.get = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/files/download')) return Promise.resolve({ data: Buffer.from(content) });
        return Promise.resolve({ data: { files: files.map((f) => ({ ...f, isDirectory: false })) } });
    });
}

describe('FewsSimulationLauncherService.launch()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.postTimeSeries.mockResolvedValue(undefined);
        mockClient.runTask.mockResolvedValue('TASK-77');
    });

    it('should send the generated input to FEWS and launch the workflow', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);

        const taskId = await buildService().launch('sim-1', OUTPUT_FOLDER, 'FEWS_API');

        expect(mockClient.postTimeSeries).toHaveBeenCalledTimes(1);
        expect(mockClient.runTask).toHaveBeenCalledTimes(1);
        expect(taskId).toBe('TASK-77');
    });

    it('should read the input from the simulation input folder', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);

        await buildService().launch('sim-1', OUTPUT_FOLDER, 'FEWS_API');

        const listCall = (mockedAxios.get as jest.Mock).mock.calls.find((c) => !String(c[0]).includes('download'));
        expect(listCall[1].params.directory).toBe(INPUT_FOLDER);
    });

    it('should describe the run with the simulation id so it is traceable inside FEWS', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);

        await buildService().launch('sim-1', OUTPUT_FOLDER, 'FEWS_API');

        const params = mockClient.runTask.mock.calls[0][1];
        expect(params.description).toContain('sim-1');
        expect(params.startTime).toBeInstanceOf(Date);
        expect(params.endTime.getTime()).toBeGreaterThan(params.startTime.getTime());
    });

    it('should fail when the simulation has no input file to send', async () => {
        mockSftp([]);

        await expect(buildService().launch('sim-1', OUTPUT_FOLDER, 'FEWS_API')).rejects.toBeInstanceOf(ProviderError);
        expect(mockClient.runTask).not.toHaveBeenCalled();
    });

    it('should not launch the workflow if posting the input failed', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);
        mockClient.postTimeSeries.mockRejectedValue(new ProviderError('boom'));

        await expect(buildService().launch('sim-1', OUTPUT_FOLDER, 'FEWS_API')).rejects.toBeInstanceOf(ProviderError);
        expect(mockClient.runTask).not.toHaveBeenCalled();
    });

    it('should drive the same requests for MOCK, only against the mock target', async () => {
        // The point of the MOCK source: not a shortcut, the same launch executed
        // against a different PI REST service.
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);

        await buildService().launch('sim-1', OUTPUT_FOLDER, 'MOCK');

        expect(mockClient.postTimeSeries).toHaveBeenCalledTimes(1);
        expect(mockClient.runTask).toHaveBeenCalledTimes(1);
        expect(mockClient.postTimeSeries.mock.calls[0][0]).toBe(MOCK_TARGET);
        expect(mockClient.runTask.mock.calls[0][0]).toBe(MOCK_TARGET);
    });
});
