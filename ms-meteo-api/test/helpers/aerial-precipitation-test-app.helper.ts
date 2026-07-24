import { DataSource, Repository } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AerialPrecipitationSeries } from '../../src/app/domain/entities/aerial-precipitation-series.entity';
import { AerialPrecipitationEvent } from '../../src/app/domain/entities/aerial-precipitation-event.entity';
import { IAerialPrecipitationSeriesRepository } from '../../src/app/domain/ports/aerial-precipitation-series-repository.port';
import { AerialPrecipitationSeriesRepository } from '../../src/app/infrastructure/persistence/aerial-precipitation-series.repository';
import { ISftpFileClient } from '../../src/app/domain/ports/sftp-file-client.port';
import { ICacheService } from '../../src/app/domain/ports/cache-service.port';
import { InMemorySftpFileClient, MockSftpDirNode } from './sftp-api.mock';
import { createTestApp, TestContext } from './test-app.helper';

export interface AerialPrecipTestContext {
    app: INestApplication;
    dataSource: DataSource;
    pgContainer: StartedPostgreSqlContainer;
    sftpClient: InMemorySftpFileClient;
    cacheService: {
        get: jest.Mock;
        set: jest.Mock;
        del: jest.Mock;
        delByPattern: jest.Mock;
    };
    seriesRepo: Repository<AerialPrecipitationSeries>;
    eventRepo: Repository<AerialPrecipitationEvent>;
}

/**
 * Wraps `createTestApp()` with the aerial-precipitation module wired.
 *
 * - Real `AerialPrecipitationSeriesRepository` against a testcontainer Postgres.
 * - `InMemorySftpFileClient` (in-memory SFTP dir tree).
 * - No-op `ICacheService` with jest.fn spies so tests can assert calls.
 *
 * @param sftpRoot    Initial SFTP directory tree (optional — empty root by default).
 * @param extraProviders Additional providers to inject into the test module.
 */
export async function createAerialPrecipTestApp(options?: {
    sftpRoot?: MockSftpDirNode;
    extraProviders?: any[];
    extraControllers?: any[];
}): Promise<AerialPrecipTestContext> {
    const sftpRoot: MockSftpDirNode = options?.sftpRoot ?? {
        type: 'dir',
        name: '',
        children: {},
    };
    const sftpClient = new InMemorySftpFileClient(sftpRoot);

    const cacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const ctx: TestContext = await createTestApp({
        entities: [AerialPrecipitationSeries, AerialPrecipitationEvent],
        controllers: options?.extraControllers ?? [],
        providers: [
            AerialPrecipitationSeriesRepository,
            { provide: IAerialPrecipitationSeriesRepository, useClass: AerialPrecipitationSeriesRepository },
            { provide: ISftpFileClient, useValue: sftpClient },
            { provide: ICacheService, useValue: cacheService },
            ...(options?.extraProviders ?? []),
        ],
    });

    return {
        app: ctx.app,
        dataSource: ctx.dataSource,
        pgContainer: ctx.pgContainer,
        sftpClient,
        cacheService,
        seriesRepo: ctx.app.get<Repository<AerialPrecipitationSeries>>(getRepositoryToken(AerialPrecipitationSeries)),
        eventRepo: ctx.app.get<Repository<AerialPrecipitationEvent>>(getRepositoryToken(AerialPrecipitationEvent)),
    };
}
