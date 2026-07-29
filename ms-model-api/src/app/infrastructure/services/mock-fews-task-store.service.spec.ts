import { Logger } from 'nestjs-pino';

import { MockFewsTaskStoreService } from './mock-fews-task-store.service';
import { FewsTaskStatus } from './fews-task-client.service';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { ENVIRONMENT } from '@config/app/app-config.type';
import { ProviderError } from '@domain/errors/provider.error';

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

const VALID_DOCUMENT = {
    version: '1.34',
    timeZone: '0.0',
    timeSeries: [{ header: { locationId: 'E_09' }, events: [] }],
};

function buildStore(overrides: { runningMs?: number; nodeEnv?: string } = {}): MockFewsTaskStoreService {
    const fewsConfig = { mockRunningMs: overrides.runningMs ?? 0 } as unknown as FewsApiConfigService;
    const sftpConfig = { baseUrl: 'http://ms-sftp-api:3003' } as unknown as SftpApiConfigService;
    const appConfig = {
        nodeEnv: overrides.nodeEnv ?? ENVIRONMENT.LOCAL,
        mockModelOutputSftpPath: 'tajo/reference/output.json',
    } as unknown as AppConfigService;
    return new MockFewsTaskStoreService(mockLogger, fewsConfig, sftpConfig, appConfig);
}

describe('MockFewsTaskStoreService — import', () => {
    beforeEach(() => jest.clearAllMocks());

    it('should report the imported series in the diagnostics, as the real endpoint does', () => {
        const diag = buildStore().importTimeSeries(VALID_DOCUMENT);

        expect(diag).toContain('1 time series imported, 0 time series rejected');
        expect(diag).toContain('<Diag');
    });

    it('should accept the document as a raw JSON string too', () => {
        const diag = buildStore().importTimeSeries(JSON.stringify(VALID_DOCUMENT));

        expect(diag).toContain('1 time series imported');
    });

    it('should reject a document carrying keys PI-JSON does not declare', () => {
        // The published schema sets additionalProperties:false, so a stray key is
        // a rejection by the real service. The fake has to behave the same or it
        // would give false confidence.
        const diag = buildStore().importTimeSeries({ ...VALID_DOCUMENT, moduleInstanceId: 'oops' });

        expect(diag).toContain('unknown properties');
        expect(diag).toContain('time series rejected');
    });

    it('should reject a document with no series', () => {
        const diag = buildStore().importTimeSeries({ version: '1.34', timeSeries: [] });

        expect(diag).toContain('carries no time series');
    });

    it('should refuse a body that is not JSON', () => {
        expect(() => buildStore().importTimeSeries('not json at all')).toThrow(ProviderError);
    });
});

describe('MockFewsTaskStoreService — task lifecycle', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('should return a task id on launch and complete immediately by default', () => {
        const store = buildStore();
        const taskId = store.runTask('mock-workflow');

        expect(taskId).toMatch(/^mock-task-/);

        const status = store.taskRunStatus(taskId);
        expect(status.code).toBe(FewsTaskStatus.COMPLETED);
        expect(status.taskRunId).toMatch(/^mock-taskrun-/);
    });

    it('should answer in the flat PI-JSON shape', () => {
        const store = buildStore();
        const status = store.taskRunStatus(store.runTask('mock-workflow'));

        // code/description/taskRunId at the root — the shape the client reads.
        expect(Object.keys(status).sort()).toEqual(['code', 'description', 'taskRunId', 'version']);
    });

    it('should walk pending → running → completed when a running window is configured', () => {
        // This is the branch the poller cannot reach at runtime with the default
        // window, so it is pinned here instead.
        const store = buildStore({ runningMs: 1000 });

        const start = 1_000_000;
        const now = jest.spyOn(Date, 'now').mockReturnValue(start);
        const taskId = store.runTask('mock-workflow');

        now.mockReturnValue(start + 100);
        expect(store.taskRunStatus(taskId).code).toBe(FewsTaskStatus.PENDING);

        now.mockReturnValue(start + 700);
        expect(store.taskRunStatus(taskId).code).toBe(FewsTaskStatus.RUNNING);

        now.mockReturnValue(start + 1500);
        expect(store.taskRunStatus(taskId).code).toBe(FewsTaskStatus.COMPLETED);
    });

    it('should withhold the taskRunId while the run is not finished', () => {
        const store = buildStore({ runningMs: 1000 });
        const start = 2_000_000;
        const now = jest.spyOn(Date, 'now').mockReturnValue(start);
        const taskId = store.runTask('mock-workflow');

        now.mockReturnValue(start + 100);
        expect(store.taskRunStatus(taskId).taskRunId).toBeNull();
    });

    it('should refuse an unknown task id', () => {
        expect(() => buildStore().taskRunStatus('nope')).toThrow(ProviderError);
    });

    it('should require a workflow id to launch', () => {
        expect(() => buildStore().runTask('')).toThrow(ProviderError);
    });

    it('should refuse to serve results for an unknown task run', async () => {
        await expect(buildStore().timeSeries('mock-taskrun-999')).rejects.toBeInstanceOf(ProviderError);
    });
});

describe('MockFewsTaskStoreService — availability', () => {
    it('should refuse to answer in production', () => {
        const store = buildStore({ nodeEnv: ENVIRONMENT.PRODUCTION });

        expect(() => store.runTask('mock-workflow')).toThrow(ProviderError);
        expect(() => store.importTimeSeries(VALID_DOCUMENT)).toThrow(ProviderError);
    });
});
