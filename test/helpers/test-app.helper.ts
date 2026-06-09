import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from '../../src/common/exceptions/http.exception';

export interface TestContext {
    app: INestApplication;
}

/**
 * Creates a NestJS test app without database (gateway is a pure proxy).
 * Mock downstream services via providers.
 */
export async function createTestApp(config: {
    controllers: any[];
    providers: any[];
    overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}): Promise<TestContext> {
    let builder = Test.createTestingModule({
        imports: [
            LoggerModule.forRoot({
                pinoHttp: { level: 'silent' },
            }),
        ],
        controllers: config.controllers,
        providers: [...config.providers, HttpExceptionFilter],
    });

    if (config.overrides) {
        builder = config.overrides(builder);
    }

    const module: TestingModule = await builder.compile();

    const app = module.createNestApplication();
    app.useGlobalPipes(new CustomValidationPipe());
    app.useGlobalFilters(app.get(HttpExceptionFilter));

    await app.init();

    return { app };
}
