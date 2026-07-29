import axios from 'axios';
import { Logger } from 'nestjs-pino';

import { FewsTaskClientService, FewsTaskStatus } from './fews-task-client.service';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { ProviderError } from '@domain/errors/provider.error';

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

function buildClient(overrides: Partial<Record<string, unknown>> = {}): FewsTaskClientService {
    const config = {
        baseUrl: BASE,
        servicePath: SERVICE,
        workflowId: 'Jarama_Henares_Forecast',
        filterId: 'TAJO_WEB',
        username: '',
        password: '',
        taskTimeoutMs: 1000,
        taskPollIntervalMs: 10,
        requestTimeoutMs: 5000,
        ...overrides,
    } as unknown as FewsApiConfigService;
    return new FewsTaskClientService(mockLogger, config);
}

describe('FewsTaskClientService.postTimeSeries()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.post = jest.fn().mockResolvedValue({ data: '<diag/>' });
    });

    it('should post the payload to the timeseries endpoint under the configured filter', async () => {
        await buildClient().postTimeSeries('<TimeSeries/>');

        const [url, body, options] = (mockedAxios.post as jest.Mock).mock.calls[0];
        expect(url).toBe(`${BASE}${SERVICE}/timeseries`);
        expect(body).toBe('<TimeSeries/>');
        expect(options.params).toMatchObject({ filterId: 'TAJO_WEB' });
    });

    it('should fail with a clear error when no filter is configured', async () => {
        await expect(buildClient({ filterId: '' }).postTimeSeries('<TimeSeries/>')).rejects.toBeInstanceOf(
            ProviderError,
        );
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });
});

describe('FewsTaskClientService.runTask()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should launch the configured workflow and return the plain-text task id', async () => {
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-123\n' });

        const taskId = await buildClient().runTask({
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

    it('should refuse to run when no workflow is configured', async () => {
        mockedAxios.post = jest.fn();

        await expect(
            buildClient({ workflowId: '' }).runTask({
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
            buildClient().runTask({ startTime: new Date(), endTime: new Date(), description: 'x' }),
        ).rejects.toBeInstanceOf(ProviderError);
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
            return Promise.resolve({ data: { status: { code, description: `state ${code}`, taskRunId: 'RUN-9' } } });
        });
    }

    it('should resolve with the task run id once the task completes', async () => {
        mockStatuses(['P', 'R', 'C']);

        const result = await buildClient().waitForTask('TASK-123');

        expect(result.status).toBe(FewsTaskStatus.COMPLETED);
        expect(result.taskRunId).toBe('RUN-9');
        expect((mockedAxios.get as jest.Mock).mock.calls.length).toBe(3);
    });

    it('should treat a partly successful run as usable, not as a failure', async () => {
        mockStatuses(['D']);

        const result = await buildClient().waitForTask('TASK-123');

        expect(result.status).toBe(FewsTaskStatus.PARTLY_SUCCESSFUL);
    });

    it('should stop and report when the task fails', async () => {
        mockStatuses(['R', 'F']);

        await expect(buildClient().waitForTask('TASK-123')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should give up when the task never leaves a running state', async () => {
        // taskTimeoutMs 1000 with a 10ms poll: it must abort rather than hang.
        mockStatuses(['R']);

        await expect(buildClient().waitForTask('TASK-123')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should not mistake an unknown status code for success', async () => {
        mockStatuses(['Z']);

        await expect(buildClient().waitForTask('TASK-123')).rejects.toBeInstanceOf(ProviderError);
    });
});

describe('FewsTaskClientService authentication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-1' });
    });

    it('should send basic auth only when credentials are configured', async () => {
        await buildClient({ username: 'u', password: 'p' }).runTask({
            startTime: new Date(),
            endTime: new Date(),
            description: 'x',
        });
        const withAuth = (mockedAxios.post as jest.Mock).mock.calls[0][2];
        expect(withAuth.auth).toEqual({ username: 'u', password: 'p' });

        jest.clearAllMocks();
        mockedAxios.post = jest.fn().mockResolvedValue({ data: 'TASK-1' });
        await buildClient().runTask({ startTime: new Date(), endTime: new Date(), description: 'x' });
        const withoutAuth = (mockedAxios.post as jest.Mock).mock.calls[0][2];
        expect(withoutAuth.auth).toBeUndefined();
    });
});
