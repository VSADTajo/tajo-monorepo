import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { CqrsModule } from '@nestjs/cqrs';

import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from '../../src/common/exceptions/http.exception';
import { ICacheService } from '../../src/app/domain/ports/cache-service.port';
import { CachingQueryBus } from '../../src/app/infrastructure/cache/caching-query-bus.service';
import { IFileTransformer } from '../../src/app/domain/ports/file-transformer.port';
import { IMappingSchemaRepository } from '../../src/app/domain/ports/mapping-schema-repository.port';
import { GetActiveMappingSchemaByPathHandler } from '../../src/app/application/queries/mapping-schema.queries';

export interface FileTestContext {
    app: INestApplication;
}

const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
};

/**
 * Creates a NestJS test app for file/SFTP tests (no database needed).
 */
export async function createFileTestApp(config: { controllers: any[]; providers: any[] }): Promise<FileTestContext> {
    const module: TestingModule = await Test.createTestingModule({
        imports: [
            CqrsModule,
            LoggerModule.forRoot({
                pinoHttp: { level: 'silent' },
            }),
        ],
        controllers: config.controllers,
        providers: [
            ...config.providers,
            HttpExceptionFilter,
            { provide: ICacheService, useValue: mockCacheService },
            { provide: IFileTransformer, useValue: { transform: jest.fn() } },
            {
                provide: IMappingSchemaRepository,
                useValue: {
                    create: jest.fn(),
                    findById: jest.fn().mockResolvedValue(null),
                    findByDirectoryPath: jest.fn().mockResolvedValue(null),
                    findAll: jest.fn().mockResolvedValue([]),
                    update: jest.fn(),
                    delete: jest.fn(),
                },
            },
            GetActiveMappingSchemaByPathHandler,
            CachingQueryBus,
        ],
    }).compile();

    const app = module.createNestApplication();
    app.useGlobalPipes(new CustomValidationPipe());
    app.useGlobalFilters(app.get(HttpExceptionFilter));

    await app.init();

    return { app };
}
