import { Controller, Get, INestApplication, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { AddressInfo } from 'net';

import { MockFewsController } from '@api/controllers/mock-fews.controller';
import { MockFewsTaskStoreService } from './mock-fews-task-store.service';
import { FewsTaskClientService, FewsTaskStatus } from './fews-task-client.service';
import { FewsResultFetcherService } from './fews-result-fetcher.service';
import { FewsTargetResolverService } from './fews-target-resolver.service';
import { FewsApiConfigService } from '@config/fews-api/fews-api-config.service';
import { SftpApiConfigService } from '@config/sftp-api/sftp-api-config.service';
import { AppConfigService } from '@config/app/app-config.service';
import { ENVIRONMENT } from '@config/app/app-config.type';
import { MOCK_FEWS_SERVICE_PATH } from './mock-fews.constants';
import { buildManualSimulationFile } from './__fixtures__/manual-simulation-input.fixture';

/**
 * Drives the MOCK source end to end over real HTTP.
 *
 * Nothing here is stubbed between the client and the fake: a real Nest server
 * hosts the fake PI REST service, and the real FewsTaskClientService reaches it
 * with real axios requests. That is the point — the value of this mock is that it
 * exercises the code that will talk to Idrica, so a test that stubbed the
 * transport would defeat it.
 *
 * The only stand-in is the ms-sftp-api boundary, served by the throwaway
 * controller below so the suite needs no Docker and no external service.
 */

/** The reference FEWS output the fake serves back, in the real PI-JSON shape. */
const REFERENCE_OUTPUT = {
    version: '1.34',
    timeZone: '0.0',
    timeSeries: [
        {
            header: {
                type: 'instantaneous',
                locationId: 'E_21',
                parameterId: 'VICT01.Validado.web',
                moduleInstanceId: 'RunMIKE11_Forecast_TajoJar_web',
                missVal: '-999.0',
                units: 'hm3',
                timeStep: { unit: 'hour', multiplier: '1' },
                startDate: { date: '2026-07-27', time: '06:00:00' },
                endDate: { date: '2026-07-27', time: '08:00:00' },
            },
            events: [
                { date: '2026-07-27', time: '06:00:00', value: '22.552', flag: '0' },
                { date: '2026-07-27', time: '07:00:00', value: '22.601', flag: '0' },
                { date: '2026-07-27', time: '08:00:00', value: '22.640', flag: '0' },
            ],
        },
        {
            header: {
                type: 'instantaneous',
                locationId: 'E_09',
                parameterId: 'VICT01.Validado.web',
                moduleInstanceId: 'RunMIKE11_Forecast_TajoJar_web',
                missVal: '-999.0',
                units: 'hm3',
                timeStep: { unit: 'hour', multiplier: '1' },
                startDate: { date: '2026-07-27', time: '06:00:00' },
                endDate: { date: '2026-07-27', time: '07:00:00' },
            },
            events: [
                { date: '2026-07-27', time: '06:00:00', value: '10.100', flag: '0' },
                { date: '2026-07-27', time: '07:00:00', value: '10.250', flag: '0' },
            ],
        },
    ],
};

const REFERENCE_PATH = 'tajo/reference/Q_mod_output_202607270600.web.json';

/** Stands in for the ms-sftp-api download endpoint the fake reads the reference from. */
@Controller('files')
class FakeSftpController {
    @Get('download')
    download(@Query('path') path: string): unknown {
        if (path !== REFERENCE_PATH) {
            throw new Error(`unexpected path ${path}`);
        }
        return REFERENCE_OUTPUT;
    }
}

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

describe('MOCK source — full round trip over HTTP', () => {
    let app: INestApplication;
    let client: FewsTaskClientService;
    let resolver: FewsTargetResolverService;
    let fetcher: FewsResultFetcherService;

    beforeAll(async () => {
        // Bound to port 0: the OS picks a free one, so the suite never collides.
        const bootModule = await Test.createTestingModule({
            controllers: [MockFewsController, FakeSftpController],
            providers: [
                MockFewsTaskStoreService,
                { provide: Logger, useValue: mockLogger },
                {
                    provide: FewsApiConfigService,
                    useValue: { mockRunningMs: 0, requestTimeoutMs: 5000, taskTimeoutMs: 5000, taskPollIntervalMs: 10 },
                },
                { provide: SftpApiConfigService, useValue: { baseUrl: '' } },
                {
                    provide: AppConfigService,
                    useValue: { nodeEnv: ENVIRONMENT.TEST, mockModelOutputSftpPath: REFERENCE_PATH },
                },
            ],
        }).compile();

        app = bootModule.createNestApplication();
        await app.init();
        await app.listen(0);

        const address = app.getHttpServer().address() as AddressInfo;
        const origin = `http://127.0.0.1:${address.port}`;

        // Rebuild the collaborators against the now-known origin: the fake reads the
        // reference through the same HTTP surface it is served on.
        const fewsConfig = {
            mockBaseUrl: origin,
            requestTimeoutMs: 5000,
            taskTimeoutMs: 5000,
            taskPollIntervalMs: 10,
        } as unknown as FewsApiConfigService;

        const store = app.get(MockFewsTaskStoreService);
        Object.assign(store, {
            sftpApiConfigService: { baseUrl: origin } as unknown as SftpApiConfigService,
            fewsApiConfigService: fewsConfig,
        });

        client = new FewsTaskClientService(mockLogger, fewsConfig);
        resolver = new FewsTargetResolverService(fewsConfig);
        fetcher = new FewsResultFetcherService(mockLogger, client, resolver);
    }, 30_000);

    afterAll(async () => {
        await app?.close();
    });

    it('should expose the fake under the path the resolver points MOCK at', () => {
        expect(resolver.resolve('MOCK').servicePath).toBe(MOCK_FEWS_SERVICE_PATH);
    });

    it('should accept a real generated input, launch, and return the results', async () => {
        const target = resolver.resolve('MOCK');

        // The input mirrors what ms-predictions-api generates, curve included.
        const input = buildManualSimulationFile();

        await expect(client.postTimeSeries(target, JSON.stringify(input))).resolves.toBeUndefined();

        const taskId = await client.runTask(target, {
            startTime: new Date('2026-07-29T00:00:00Z'),
            endTime: new Date('2026-08-01T00:00:00Z'),
            description: 'Manual simulation round-trip',
        });
        expect(taskId).toMatch(/^mock-task-/);

        const outcome = await client.waitForTask(target, taskId);
        expect(outcome.status).toBe(FewsTaskStatus.COMPLETED);
        expect(outcome.taskRunId).toMatch(/^mock-taskrun-/);

        const series = await client.getTimeSeries(target, outcome.taskRunId);
        expect(series).toMatchObject({ version: '1.34' });
    });

    it('should produce normalized series through the fetcher the poller uses', async () => {
        // The whole reason the mock exists: the poller's own collaborator has to
        // come back with usable series, not just a 200.
        const target = resolver.resolve('MOCK');
        await client.postTimeSeries(target, JSON.stringify(buildManualSimulationFile()));
        const taskId = await client.runTask(target, {
            startTime: new Date('2026-07-29T00:00:00Z'),
            endTime: new Date('2026-08-01T00:00:00Z'),
            description: 'Manual simulation round-trip',
        });

        const result = await fetcher.fetchByTask(taskId, 'MOCK');

        expect(result).not.toBeNull();
        expect(result!.timeSeries.length).toBe(2);
        expect(result!.timeSeries.map((s) => s.locationId).sort()).toEqual(['E_09', 'E_21']);
        // Every series carries its events: an empty round trip would look like a
        // pass while delivering nothing, which is the failure we care about.
        expect(result!.timeSeries.every((s) => s.events.length > 0)).toBe(true);
        expect(result!.skippedEmptySeries).toBe(0);
        expect(result!.skippedInvalidSeries).toBe(0);
    });

    it('should reject an input that does not conform to PI-JSON, over the wire', async () => {
        // Proves the round trip can actually fail: a mock that says yes to
        // everything would make the green tests above meaningless.
        const target = resolver.resolve('MOCK');
        const malformed = { ...buildManualSimulationFile(), moduleInstanceId: 'not allowed here' };

        await expect(client.postTimeSeries(target, JSON.stringify(malformed))).rejects.toThrow(
            /rejected the simulation input/,
        );
    });
});
