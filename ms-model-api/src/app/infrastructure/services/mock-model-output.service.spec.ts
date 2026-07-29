import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { MockModelOutputService } from './mock-model-output.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
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
const MOCK_PATH = 'tajo/mock/tagus_Q_mod_reference.json';

function buildService(mockPath: string = MOCK_PATH): MockModelOutputService {
    const sftpConfig = { baseUrl: 'http://ms-sftp-api:3003' } as unknown as SftpApiConfigService;
    const appConfig = { mockModelOutputSftpPath: mockPath } as unknown as AppConfigService;
    return new MockModelOutputService(mockLogger, sftpConfig, appConfig);
}

describe('MockModelOutputService.seedOutput()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.get = jest.fn().mockResolvedValue({ data: Buffer.from('{"timeSeries":[]}') });
        mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });
    });

    it('should copy the reference output into the simulation output folder', async () => {
        await buildService().seedOutput(OUTPUT_FOLDER);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('/files/download'),
            expect.objectContaining({ params: { path: MOCK_PATH } }),
        );
        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('/files/upload'),
            expect.anything(),
            expect.anything(),
        );
    });

    it('should keep the reference file name so the result looks like a real delivery', async () => {
        const service = buildService('tajo/mock/tagus_Q_mod_202607271100.json');

        const uploadedTo = await service.seedOutput(OUTPUT_FOLDER);

        expect(uploadedTo).toBe(`${OUTPUT_FOLDER}/tagus_Q_mod_202607271100.json`);
    });

    it('should fail loudly when no reference output is configured', async () => {
        await expect(buildService('').seedOutput(OUTPUT_FOLDER)).rejects.toBeInstanceOf(ProviderError);
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fail when the reference output cannot be downloaded', async () => {
        mockedAxios.get = jest.fn().mockRejectedValue(new Error('404'));

        await expect(buildService().seedOutput(OUTPUT_FOLDER)).rejects.toBeInstanceOf(ProviderError);
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should never consume the reference file — it must stay reusable', async () => {
        await buildService().seedOutput(OUTPUT_FOLDER);

        const movedOrDeleted = (mockedAxios.post as jest.Mock).mock.calls.some((call) =>
            String(call[0]).includes('/files/move'),
        );
        expect(movedOrDeleted).toBe(false);
    });
});
