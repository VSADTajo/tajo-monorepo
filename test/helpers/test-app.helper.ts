import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { LoggerModule } from 'nestjs-pino';
import { CqrsModule } from '@nestjs/cqrs';

import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from '../../src/common/exceptions/http.exception';

export interface TestContext {
    app: INestApplication;
    dataSource: DataSource;
    pgContainer: StartedPostgreSqlContainer;
}

/**
 * Levanta una app de NestJS con Postgres real en Docker (testcontainers).
 *
 * Reemplaza la DB real por un container efímero de Postgres.
 * Solo mockear servicios externos (email, APIs, etc.), nunca repositorios.
 *
 * @param entities - Las entidades TypeORM que necesita el test
 * @param controllers - Los controllers a registrar
 * @param providers - Handlers, servicios y providers (incluye overrides de ports)
 * @param overrides - Función opcional para overrideProvider (servicios externos)
 */
export async function createTestApp(config: {
    entities: any[];
    controllers: any[];
    providers: any[];
    overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}): Promise<TestContext> {
    // 1. Levantar Postgres en Docker
    const pgContainer = await new PostgreSqlContainer('postgres:16-alpine').withDatabase('test_db').start();

    // 2. Compilar el módulo sin depender de modules de producción que traen config real
    let builder = Test.createTestingModule({
        imports: [
            TypeOrmModule.forRoot({
                type: 'postgres',
                host: pgContainer.getHost(),
                port: pgContainer.getMappedPort(5432),
                username: pgContainer.getUsername(),
                password: pgContainer.getPassword(),
                database: pgContainer.getDatabase(),
                entities: config.entities,
                synchronize: true,
            }),
            TypeOrmModule.forFeature(config.entities),
            CqrsModule,
            LoggerModule.forRoot({
                pinoHttp: { level: 'silent' },
            }),
        ],
        controllers: config.controllers,
        providers: [...config.providers, HttpExceptionFilter],
    });

    // 3. Aplicar overrides si los hay
    if (config.overrides) {
        builder = config.overrides(builder);
    }

    const module: TestingModule = await builder.compile();

    // 4. Crear la app con la misma config que main.ts
    const app = module.createNestApplication();
    app.useGlobalPipes(new CustomValidationPipe());
    app.useGlobalFilters(app.get(HttpExceptionFilter));

    await app.init();

    return {
        app,
        dataSource: app.get(DataSource),
        pgContainer,
    };
}
