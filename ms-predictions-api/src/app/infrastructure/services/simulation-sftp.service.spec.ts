import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { SimulationSftpService } from './simulation-sftp.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

const SIM_ID = 'cf9d13c4-3a81-40c5-a438-45f2a8b9fa2c';
const BASE = 'http://ms-sftp-api:3003';

function buildService(): SimulationSftpService {
    const config = { baseUrl: BASE } as unknown as SftpApiConfigService;
    return new SimulationSftpService(mockLogger, config);
}

function entry(name: string, isDirectory = false) {
    return { name, size: 100, isDirectory, modifiedAt: '2026-07-28T23:39:00Z' };
}

/**
 * Routes each directory listing to its own fixture, so the test mirrors the real
 * layout: ms-model-api moves the result into output/historial/ (parsed) or
 * output/corrupted/ (unreadable) as soon as it polls it.
 */
function mockListing(byDirectory: Record<string, ReturnType<typeof entry>[]>): void {
    mockedAxios.get = jest.fn().mockImplementation((_url: string, cfg: any) => {
        const dir = cfg?.params?.directory as string;
        if (dir in byDirectory) {
            return Promise.resolve({ data: { files: byDirectory[dir] } });
        }
        const notFound: any = new Error('not found');
        notFound.isAxiosError = true;
        notFound.response = { status: 404 };
        return Promise.reject(notFound);
    });
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn((e: any) => e?.isAxiosError === true);
}

describe('SimulationSftpService.listFiles()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should list a result still waiting to be polled as pending', () => {
        mockListing({
            [`tajo/SIMULATIONS/${SIM_ID}/input`]: [entry('Q_mod_input_202607282330.json')],
            [`tajo/SIMULATIONS/${SIM_ID}/output`]: [entry('tagus_Q_mod_202607271100.json')],
        });

        return buildService()
            .listFiles(SIM_ID)
            .then((files) => {
                expect(files.output).toHaveLength(1);
                expect(files.output[0].status).toBe('pending');
                expect(files.input[0].status).toBe('pending');
            });
    });

    it('should still show the result after it was moved to historial/, as processed', async () => {
        mockListing({
            [`tajo/SIMULATIONS/${SIM_ID}/input`]: [entry('Q_mod_input_202607282330.json')],
            // ms-model-api already consumed it: output/ holds only the sub-folder
            [`tajo/SIMULATIONS/${SIM_ID}/output`]: [entry('historial', true)],
            [`tajo/SIMULATIONS/${SIM_ID}/output/historial`]: [entry('tagus_Q_mod_202607271100.json')],
        });

        const files = await buildService().listFiles(SIM_ID);

        expect(files.output).toHaveLength(1);
        expect(files.output[0].name).toBe('tagus_Q_mod_202607271100.json');
        expect(files.output[0].status).toBe('processed');
    });

    it('should surface a result that failed to parse as failed, not as missing', async () => {
        mockListing({
            [`tajo/SIMULATIONS/${SIM_ID}/input`]: [],
            [`tajo/SIMULATIONS/${SIM_ID}/output`]: [entry('corrupted', true)],
            [`tajo/SIMULATIONS/${SIM_ID}/output/corrupted`]: [entry('tagus_Q_mod_202607271100.json')],
        });

        const files = await buildService().listFiles(SIM_ID);

        expect(files.output).toHaveLength(1);
        expect(files.output[0].status).toBe('failed');
    });

    it('should list files across output/ and its sub-folders together', async () => {
        mockListing({
            [`tajo/SIMULATIONS/${SIM_ID}/input`]: [],
            [`tajo/SIMULATIONS/${SIM_ID}/output`]: [
                entry('nuevo.json'),
                entry('historial', true),
                entry('corrupted', true),
            ],
            [`tajo/SIMULATIONS/${SIM_ID}/output/historial`]: [entry('viejo.json')],
            [`tajo/SIMULATIONS/${SIM_ID}/output/corrupted`]: [entry('roto.json')],
        });

        const files = await buildService().listFiles(SIM_ID);

        expect(files.output.map((f) => [f.name, f.status])).toEqual(
            expect.arrayContaining([
                ['nuevo.json', 'pending'],
                ['viejo.json', 'processed'],
                ['roto.json', 'failed'],
            ]),
        );
    });

    it('should not report sub-folders themselves as files', async () => {
        mockListing({
            [`tajo/SIMULATIONS/${SIM_ID}/input`]: [],
            [`tajo/SIMULATIONS/${SIM_ID}/output`]: [entry('historial', true)],
            [`tajo/SIMULATIONS/${SIM_ID}/output/historial`]: [],
        });

        const files = await buildService().listFiles(SIM_ID);

        expect(files.output).toEqual([]);
    });

    it('should treat a missing output folder as empty rather than failing', async () => {
        mockListing({ [`tajo/SIMULATIONS/${SIM_ID}/input`]: [entry('in.json')] });

        const files = await buildService().listFiles(SIM_ID);

        expect(files.output).toEqual([]);
        expect(files.input).toHaveLength(1);
    });
});

describe('SimulationSftpService.downloadFile()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /** Serves the file only from `availableAt`; every other path 404s. */
    function mockDownload(availableAt: string): void {
        mockedAxios.get = jest.fn().mockImplementation((_url: string, cfg: any) => {
            if (cfg?.params?.path === availableAt) {
                return Promise.resolve({ data: Buffer.from('{}'), headers: { 'content-type': 'application/json' } });
            }
            const notFound: any = new Error('not found');
            notFound.isAxiosError = true;
            notFound.response = { status: 404 };
            return Promise.reject(notFound);
        });
        (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn((e: any) => e?.isAxiosError === true);
    }

    it('should download a file that is still directly in output/', async () => {
        mockDownload(`tajo/SIMULATIONS/${SIM_ID}/output/result.json`);

        const file = await buildService().downloadFile(SIM_ID, 'output', 'result.json');

        expect(file.fileName).toBe('result.json');
    });

    it('should find a processed file that was moved to historial/', async () => {
        mockDownload(`tajo/SIMULATIONS/${SIM_ID}/output/historial/result.json`);

        const file = await buildService().downloadFile(SIM_ID, 'output', 'result.json');

        expect(file.fileName).toBe('result.json');
    });

    it('should find a failed file that was moved to corrupted/', async () => {
        mockDownload(`tajo/SIMULATIONS/${SIM_ID}/output/corrupted/result.json`);

        const file = await buildService().downloadFile(SIM_ID, 'output', 'result.json');

        expect(file.fileName).toBe('result.json');
    });

    it('should still 404 when the file is nowhere', async () => {
        mockDownload('tajo/SIMULATIONS/other/output/nope.json');

        await expect(buildService().downloadFile(SIM_ID, 'output', 'result.json')).rejects.toMatchObject({
            statusCode: 404,
        });
    });
});
