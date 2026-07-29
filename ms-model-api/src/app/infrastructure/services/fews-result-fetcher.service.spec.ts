import { Logger } from 'nestjs-pino';

import { FewsResultFetcherService } from './fews-result-fetcher.service';
import { FewsTaskClientService, FewsTaskStatus, TaskOutcome } from './fews-task-client.service';
import { FewsTargetResolverService } from './fews-target-resolver.service';
import { ProviderError } from '@domain/errors/provider.error';
import { FewsTarget } from '@domain/types/fews-target.type';

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

const REAL_TARGET: FewsTarget = {
    baseUrl: 'https://fews.example.org/FewsWebServices',
    servicePath: '/rest/fewspiservice/v1',
    filterId: 'TAJO_WEB',
    workflowId: 'wf',
    username: '',
    password: '',
};

const MOCK_TARGET: FewsTarget = { ...REAL_TARGET, baseUrl: 'http://127.0.0.1:3008' };

const PI_JSON_RESULT = {
    version: '1.34',
    timeZone: '0.0',
    timeSeries: [
        {
            header: {
                locationId: 'E_09',
                parameterId: 'VICT01.Validado',
                moduleInstanceId: 'RunMIKE11',
                missVal: '-999.0',
                units: 'hm3',
                timeStep: { unit: 'hour', multiplier: '1' },
                startDate: { date: '2026-07-22', time: '00:00:00' },
                endDate: { date: '2026-07-22', time: '01:00:00' },
            },
            events: [
                { date: '2026-07-22', time: '00:00:00', value: '10.5', flag: '0' },
                { date: '2026-07-22', time: '01:00:00', value: '11.0', flag: '0' },
            ],
        },
    ],
};

const mockClient = {
    getTaskStatus: jest.fn(),
    getTimeSeries: jest.fn(),
};

const mockResolver = {
    resolve: jest.fn((source: string) => (source === 'MOCK' ? MOCK_TARGET : REAL_TARGET)),
};

function buildService(): FewsResultFetcherService {
    return new FewsResultFetcherService(
        mockLogger,
        mockClient as unknown as FewsTaskClientService,
        mockResolver as unknown as FewsTargetResolverService,
    );
}

function outcome(status: FewsTaskStatus, taskRunId = 'RUN-1'): TaskOutcome {
    return { status, description: `state ${status}`, taskRunId };
}

describe('FewsResultFetcherService.fetchByTask()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.getTimeSeries.mockResolvedValue(PI_JSON_RESULT);
    });

    it('should return the parsed series once the task completed', async () => {
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.COMPLETED));

        const result = await buildService().fetchByTask('TASK-1', 'FEWS_API');

        expect(result?.timeSeries.length).toBe(1);
        expect(result?.processedFileName).toBe('fews-taskrun-RUN-1');
    });

    it('should return null while the task is still running so the poller retries', async () => {
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.RUNNING, ''));

        await expect(buildService().fetchByTask('TASK-1', 'FEWS_API')).resolves.toBeNull();
        expect(mockClient.getTimeSeries).not.toHaveBeenCalled();
    });

    it('should read a partly successful run rather than discard it', async () => {
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.PARTLY_SUCCESSFUL));

        await expect(buildService().fetchByTask('TASK-1', 'FEWS_API')).resolves.not.toBeNull();
    });

    it('should fail loudly when the task failed instead of waiting forever', async () => {
        // Previously a failed task returned null, so the run sat in WAITING_RESULT
        // until the timeout with nothing explaining why.
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.FAILED, ''));

        await expect(buildService().fetchByTask('TASK-1', 'FEWS_API')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should fail on a terminated task', async () => {
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.TERMINATED, ''));

        await expect(buildService().fetchByTask('TASK-1', 'FEWS_API')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should not assume success on an unrecognised status', async () => {
        mockClient.getTaskStatus.mockResolvedValue({ status: 'Z' as FewsTaskStatus, description: '', taskRunId: '' });

        await expect(buildService().fetchByTask('TASK-1', 'FEWS_API')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should fail when a finished task reports no taskRunId', async () => {
        // The status endpoint only returns taskRunId from FEWS 2024.01 on, and the
        // results are addressed by it — there is nothing to poll for.
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.COMPLETED, ''));

        await expect(buildService().fetchByTask('TASK-1', 'FEWS_API')).rejects.toBeInstanceOf(ProviderError);
    });

    it('should follow a MOCK run against the mock target', async () => {
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.COMPLETED));

        await buildService().fetchByTask('mock-task-1', 'MOCK');

        expect(mockClient.getTaskStatus).toHaveBeenCalledWith(MOCK_TARGET, 'mock-task-1');
        expect(mockClient.getTimeSeries).toHaveBeenCalledWith(MOCK_TARGET, 'RUN-1');
    });

    it('should follow a FEWS_API run against the real target', async () => {
        mockClient.getTaskStatus.mockResolvedValue(outcome(FewsTaskStatus.COMPLETED));

        await buildService().fetchByTask('TASK-1', 'FEWS_API');

        expect(mockClient.getTaskStatus).toHaveBeenCalledWith(REAL_TARGET, 'TASK-1');
    });
});
