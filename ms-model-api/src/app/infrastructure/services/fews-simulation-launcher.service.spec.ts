import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { FewsSimulationLauncherService } from './fews-simulation-launcher.service';
import { FewsTaskClientService } from './fews-task-client.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { ProviderError } from '@domain/errors/provider.error';

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

const mockClient = {
    postTimeSeries: jest.fn(),
    runTask: jest.fn(),
};

function buildService(): FewsSimulationLauncherService {
    const sftpConfig = { baseUrl: 'http://ms-sftp-api:3003' } as unknown as SftpApiConfigService;
    return new FewsSimulationLauncherService(mockLogger, sftpConfig, mockClient as unknown as FewsTaskClientService);
}

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

        const taskId = await buildService().launch('sim-1', OUTPUT_FOLDER);

        expect(mockClient.postTimeSeries).toHaveBeenCalledTimes(1);
        expect(mockClient.runTask).toHaveBeenCalledTimes(1);
        expect(taskId).toBe('TASK-77');
    });

    it('should read the input from the simulation input folder', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);

        await buildService().launch('sim-1', OUTPUT_FOLDER);

        const listCall = (mockedAxios.get as jest.Mock).mock.calls.find((c) => !String(c[0]).includes('download'));
        expect(listCall[1].params.directory).toBe(INPUT_FOLDER);
    });

    it('should describe the run with the simulation id so it is traceable inside FEWS', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);

        await buildService().launch('sim-1', OUTPUT_FOLDER);

        const params = mockClient.runTask.mock.calls[0][0];
        expect(params.description).toContain('sim-1');
        expect(params.startTime).toBeInstanceOf(Date);
        expect(params.endTime.getTime()).toBeGreaterThan(params.startTime.getTime());
    });

    it('should fail when the simulation has no input file to send', async () => {
        mockSftp([]);

        await expect(buildService().launch('sim-1', OUTPUT_FOLDER)).rejects.toBeInstanceOf(ProviderError);
        expect(mockClient.runTask).not.toHaveBeenCalled();
    });

    it('should not launch the workflow if posting the input failed', async () => {
        mockSftp([{ name: 'Q_mod_input_202607291200.json' }]);
        mockClient.postTimeSeries.mockRejectedValue(new ProviderError('boom'));

        await expect(buildService().launch('sim-1', OUTPUT_FOLDER)).rejects.toBeInstanceOf(ProviderError);
        expect(mockClient.runTask).not.toHaveBeenCalled();
    });
});
