import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { FewsTaskClientService, FewsTaskStatus } from './fews-task-client.service';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
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

const BASE = 'https://fews.example.org/FewsWebServices';
const SERVICE = '/rest/fewspiservice/v1';

/** A clean import diagnostic, as the real endpoint answers on success. */
const OK_DIAG = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Diag xmlns="http://www.wldelft.nl/fews/PI" version="1.2">',
    '    <line level="3" description="Import.info: 2 time series imported, 0 time series rejected"/>',
    '</Diag>',
].join('\n');

function buildTarget(overrides: Partial<FewsTarget> = {}): FewsTarget {
    return {
        baseUrl: BASE,
        servicePath: SERVICE,
        workflowId: 'Jarama_Henares_Forecast',
        filterId: 'TAJO_WEB',
        username: '',
        password: '',
        ...overrides,
    };
}

function buildClient(): FewsTaskClientService {
    const config = {
        taskTimeoutMs: 1000,
        taskPollIntervalMs: 10,
        requestTimeoutMs: 5000,
        runUserId: 'fews',
        runOption: 'alloneatatime',
    } as unknown as FewsApiConfigService;
    return new FewsTaskClientService(mockLogger, config);
}

describe('FewsTaskClientService.postTimeSeries()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.post = jest.fn().mockResolvedValue({ data: OK_DIAG });
    });

    it('should post the payload to the timeseries endpoint under the configured filter', async () => {
        await buildClient().postTimeSeries(buildTarget(), '{"version":"1.34"}');

        const [url, body, options] = (mockedAxios.post as jest.Mock).mock.calls[0];
        expect(url).toBe(`${BASE}${SERVICE}/timeseries`);
        expect(new URLSearchParams(body).get('piTimeSeriesJsonContent')).toBe('{"version":"1.34"}');
        expect(options.params).toMatchObject({ filterId: 'TAJO_WEB' });
    });

    it('should send the PI-JSON document as the piTimeSeriesJsonContent form field', async () => {
        // The API also declares a raw application/json body, but Idrica could only
        // get the import to work on the CH Tajo instance with the form encoding.
        await buildClient().postTimeSeries(buildTarget(), '{"version":"1.34"}');

        const options = (mockedAxios.post as jest.Mock).mock.calls[0][2];
        expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('should fail with a clear error when no filter is configured', async () => {
        await expect(
            buildClient().postTimeSeries(buildTarget({ filterId: '' }), '{"version":"1.34"}'),
        ).rejects.toBeInstanceOf(ProviderError);
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should fail when the diagnostics report rejected series despite a 200', async () => {
        // FEWS answers 200 with a Diag that reports what it actually took, so a
        // successful status code alone is not evidence the import happened.
        mockedAxios.post = jest.fn().mockResolvedValue({
            data:
                '<Diag version="1.2">' +
                '<line level="3" description="Import.info: 0 time series imported, 2 time series rejected"/>' +
                '</Diag>',
        });

        await expect(buildClient().postTimeSeries(buildTarget(), '{"version":"1.34"}')).rejects.toBeInstanceOf(
            ProviderError,
        );
    });

    it('should fail when the diagnostics contain an error line', async () => {
        mockedAxios.post = jest.fn().mockResolvedValue({
            data:
                '<Diag version="1.2">' +
                '<line level="1" description="Import.error: could not map location E_99"/>' +
                '</Diag>',
        });

        await expect(buildClient().postTimeSeries(buildTarget(), '{"version":"1.34"}')).rejects.toBeInstanceOf(
            ProviderError,
        );
    });

    it('should accept warnings and informational lines', async () => {
        mockedAxios.post = jest.fn().mockResolvedValue({
            data:
                '<Diag version="1.2">' +
                '<line level="2" description="Multiple time series sets found for parameter=Q.salida.forecast"/>' +
                '<line level="3" description="Import.info: 1 time series imported, 0 time series rejected"/>' +
                '</Diag>',
        });

        await expect(buildClient().postTimeSeries(buildTarget(), '{"version":"1.34"}')).resolves.toBeUndefined();
    });
});

describe('FewsTaskClientService.runTask()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should launch the configured workflow and return the plain-text task id', async () => {
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-123\n' });

        const taskId = await buildClient().runTask(buildTarget(), {
            startTime: new Date('2026-07-27T09:00:00Z'),
            endTime: new Date('2026-07-30T09:00:00Z'),
            description: 'manual simulation abc',
        });

        expect(taskId).toBe('TASK-123');
        const [url, , options] = (mockedAxios.post as jest.Mock).mock.calls[0];
        expect(url).toBe(`${BASE}${SERVICE}/runtask`);
        expect(options.params).toMatchObject({
            workflowId: 'Jarama_Henares_Forecast',
            startTime: '2026-07-27T09:00:00Z',
            endTime: '2026-07-30T09:00:00Z',
            description: 'manual simulation abc',
        });
    });

    it('should send the run parameters Idrica validated: timeZero, userId, run option, no local promotion', async () => {
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-123' });

        await buildClient().runTask(buildTarget(), {
            startTime: new Date('2026-07-27T09:00:00Z'),
            endTime: new Date('2026-07-30T09:00:00Z'),
            description: 'x',
        });

        const options = (mockedAxios.post as jest.Mock).mock.calls[0][2];
        expect(options.params).toMatchObject({
            timeZero: '2026-07-27T09:00:00Z',
            userId: 'fews',
            runOption: 'alloneatatime',
            runLocallyAndPromoteToServer: 'false',
        });
    });

    it('should refuse to run when no workflow is configured', async () => {
        mockedAxios.post = jest.fn();

        await expect(
            buildClient().runTask(buildTarget({ workflowId: '' }), {
                startTime: new Date(),
                endTime: new Date(),
                description: 'x',
            }),
        ).rejects.toBeInstanceOf(ProviderError);
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should fail when FEWS answers without a task id', async () => {
        mockedAxios.post = jest.fn().mockResolvedValue({ data: '   ' });

        await expect(
            buildClient().runTask(buildTarget(), { startTime: new Date(), endTime: new Date(), description: 'x' }),
        ).rejects.toBeInstanceOf(ProviderError);
    });
});

describe('FewsTaskClientService.getTaskStatus()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should request PI_JSON explicitly', async () => {
        // Without documentFormat the endpoint answers text/plain with the bare
        // status letter, and there is no envelope to read.
        mockedAxios.get = jest.fn().mockResolvedValue({ data: { version: '1.2', code: 'C', description: 'done' } });

        await buildClient().getTaskStatus(buildTarget(), 'TASK-1');

        const options = (mockedAxios.get as jest.Mock).mock.calls[0][1];
        expect(options.params).toMatchObject({ taskId: 'TASK-1', documentFormat: 'PI_JSON' });
    });

    it('should read the flat PI-JSON envelope', async () => {
        // code, description and taskRunId sit at the root of the document — not
        // nested under a `status` object.
        mockedAxios.get = jest.fn().mockResolvedValue({
            data: { version: '1.2', code: 'C', description: 'completed fully successful', taskRunId: 'RUN-9' },
        });

        const outcome = await buildClient().getTaskStatus(buildTarget(), 'TASK-1');

        expect(outcome.status).toBe(FewsTaskStatus.COMPLETED);
        expect(outcome.description).toBe('completed fully successful');
        expect(outcome.taskRunId).toBe('RUN-9');
    });
});

describe('FewsTaskClientService.getTaskStatus() when FEWS answers no status', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should report a null code as unavailable, which counts as in flight', async () => {
        // Idrica: `null` = no status available, produced when the lookup times out.
        mockedAxios.get = jest.fn().mockResolvedValue({ data: { version: '1.2', code: null, taskRunId: null } });

        const outcome = await buildClient().getTaskStatus(buildTarget(), 'TASK-1');

        expect(outcome.status).toBe(FewsTaskStatus.UNAVAILABLE);
        expect(FewsTaskClientService.isInFlight(outcome.status)).toBe(true);
        expect(FewsTaskClientService.isUsable(outcome.status)).toBe(false);
        expect(FewsTaskClientService.isTerminalFailure(outcome.status)).toBe(false);
    });
});

describe('FewsTaskClientService.waitForTask()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /** Answers each poll with the next status code in the list. */
    function mockStatuses(codes: string[]): void {
        let call = 0;
        mockedAxios.get = jest.fn().mockImplementation(() => {
            const code = codes[Math.min(call, codes.length - 1)];
            call += 1;
            return Promise.resolve({
                data: { version: '1.2', code, description: `state ${code}`, taskRunId: 'RUN-9' },
            });
        });
    }

    it('should resolve with the task run id once the task completes', async () => {
        mockStatuses(['P', 'R', 'C']);

        const result = await buildClient().waitForTask(buildTarget(), 'TASK-123');

        expect(result.status).toBe(FewsTaskStatus.COMPLETED);
        expect(result.taskRunId).toBe('RUN-9');
        expect((mockedAxios.get as jest.Mock).mock.calls.length).toBe(3);
    });

    it('should treat a partly successful run as usable, not as a failure', async () => {
        mockStatuses(['D']);

        const result = await buildClient().waitForTask(buildTarget(), 'TASK-123');

        expect(result.status).toBe(FewsTaskStatus.PARTLY_SUCCESSFUL);
    });

    it('should stop and report when the task fails', async () => {
        mockStatuses(['R', 'F']);

        await expect(buildClient().waitForTask(buildTarget(), 'TASK-123')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should give up when the task never leaves a running state', async () => {
        // taskTimeoutMs 1000 with a 10ms poll: it must abort rather than hang.
        mockStatuses(['R']);

        await expect(buildClient().waitForTask(buildTarget(), 'TASK-123')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should not mistake an unknown status code for success', async () => {
        mockStatuses(['Z']);

        await expect(buildClient().waitForTask(buildTarget(), 'TASK-123')).rejects.toBeInstanceOf(ProviderError);
    });
});

describe('FewsTaskClientService.getTimeSeries()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should read the results of a task run as PI-JSON under the configured filter', async () => {
        mockedAxios.get = jest.fn().mockResolvedValue({ status: 200, data: { version: '1.34', timeSeries: [] } });

        const result = await buildClient().getTimeSeries(buildTarget(), 'RUN-9');

        expect(result).toEqual({ document: { version: '1.34', timeSeries: [] }, complete: true });
        const [url, options] = (mockedAxios.get as jest.Mock).mock.calls[0];
        expect(url).toBe(`${BASE}${SERVICE}/timeseries`);
        expect(options.params).toMatchObject({
            documentFormat: 'PI_JSON',
            filterId: 'TAJO_WEB',
            taskRunIds: 'RUN-9',
        });
    });

    it('should flag a 206 as incomplete instead of handing back a partial run', async () => {
        mockedAxios.get = jest.fn().mockResolvedValue({ status: 206, data: { version: '1.34', timeSeries: [] } });

        const result = await buildClient().getTimeSeries(buildTarget(), 'RUN-9');

        expect(result.complete).toBe(false);
    });
});

describe('FewsTaskClientService authentication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-1' });
    });

    it('should send basic auth only when credentials are configured', async () => {
        await buildClient().runTask(buildTarget({ username: 'u', password: 'p' }), {
            startTime: new Date(),
            endTime: new Date(),
            description: 'x',
        });
        const withAuth = (mockedAxios.post as jest.Mock).mock.calls[0][2];
        expect(withAuth.auth).toEqual({ username: 'u', password: 'p' });

        jest.clearAllMocks();
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-1' });
        await buildClient().runTask(buildTarget(), {
            startTime: new Date(),
            endTime: new Date(),
            description: 'x',
        });
        const withoutAuth = (mockedAxios.post as jest.Mock).mock.calls[0][2];
        expect(withoutAuth.auth).toBeUndefined();
    });
});
