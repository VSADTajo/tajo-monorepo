import { INestApplication } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { AddressInfo } from 'net';

import { MockWiskiController } from '@api/controllers/mock-wiski.controller';
import { WiskiApiProviderService } from './wiski-api-provider.service';
import { WiskiApiConfigService } from '@config/wiski-api/wiski-api-config.service';
import { ProviderConfig } from '@domain/entities/provider-config.entity';
import { MOCK_WISKI_PATH } from '@common/mock-wiski.constants';
import { ClientWhitelistMiddleware } from '@common/middleware/client-whitelist.middleware';

/**
 * Drives the WISKI_API provider end to end over real HTTP.
 *
 * Their endpoint resolves only inside CH Tajo's network, so this is the only
 * way to exercise the client, the whitelist exemption and the mapper together
 * before that access exists. Nothing between the provider and the fixture is
 * stubbed: a real Nest server answers, real axios asks.
 */

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger;

describe('WISKI mock — full round trip over HTTP', () => {
    let app: INestApplication;
    let provider: WiskiApiProviderService;
    let origin: string;

    beforeAll(async () => {
        const bootModule = await Test.createTestingModule({
            controllers: [MockWiskiController],
            providers: [{ provide: Logger, useValue: mockLogger }],
        }).compile();

        app = bootModule.createNestApplication();

        // The real app applies this to every route and only lets the gateway
        // through. Installing it here is what proves the mock is reachable in
        // production shape rather than only in a controller test.
        const whitelist = new ClientWhitelistMiddleware();
        app.use((req: Request, res: Response, next: NextFunction) => whitelist.use(req, res, next));

        await app.init();
        await app.listen(0);

        const address = app.getHttpServer().address() as AddressInfo;
        origin = `http://127.0.0.1:${address.port}`;

        const config = {
            baseUrl: '',
            path: MOCK_WISKI_PATH,
            timezone: 'Europe/Madrid',
            requestTimeoutMs: 5000,
            maxResponseBytes: 5 * 1024 * 1024,
            token: '',
            mockBaseUrl: origin,
        } as unknown as WiskiApiConfigService;

        provider = new WiskiApiProviderService(mockLogger, config);
    }, 30_000);

    afterAll(async () => {
        await app?.close();
    });

    function buildConfig(settings: Record<string, unknown> = {}): ProviderConfig {
        return new ProviderConfig({
            id: '22222222-2222-2222-2222-222222222222',
            name: 'WISKI mock',
            type: 'WISKI_API',
            baseUrl: origin,
            pollingIntervalMinutes: 60,
            isActive: true,
            settings: { endpointPath: MOCK_WISKI_PATH, ...settings },
        });
    }

    it('reaches the fake through the whitelist and maps the fixture', async () => {
        const series = await provider.fetch(buildConfig());

        // Four series in the fixture, and every one carries readings.
        expect(series).toHaveLength(4);
        expect(series.every((s) => s.events.length > 0)).toBe(true);
    });

    it('resolves each series exactly as the CSV export spells it', async () => {
        const series = await provider.fetch(buildConfig());
        const victoria = series.find((s) => s.locationId === 'E_08' && s.parameterId === 'VICT01.historical');

        expect(victoria).toBeDefined();
        expect(victoria!.units).toBe('Hm3');
        expect(victoria!.timeStep).toEqual({ unit: 'MINUTE', multiplier: 15 });
    });

    it('returns the readings oldest first even though the endpoint answers newest first', async () => {
        const series = await provider.fetch(buildConfig());
        const timestamps = series[0].events.map((event) => event.timestamp);

        expect([...timestamps].sort()).toEqual(timestamps);
        expect(series[0].startDate).toBe(timestamps[0]);
        expect(series[0].endDate).toBe(timestamps[timestamps.length - 1]);
    });

});
