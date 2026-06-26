import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { LoggerModule } from 'nestjs-pino';
import { CqrsModule } from '@nestjs/cqrs';

import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { HttpExceptionFilter } from '../../src/common/exceptions/http.exception';

import { User } from '../../src/app/domain/entities/user.entity';
import { Role } from '../../src/app/domain/entities/role.entity';
import { UserRole } from '../../src/app/domain/entities/user-role.entity';
import { Permission } from '../../src/app/domain/entities/permission.entity';
import { RolePermission } from '../../src/app/domain/entities/role-permission.entity';
import { Group } from '../../src/app/domain/entities/group.entity';
import { GroupRole } from '../../src/app/domain/entities/group-role.entity';
import { UserGroup } from '../../src/app/domain/entities/user-group.entity';

/**
 * Full TypeORM entity graph for ms-user-api.
 *
 * Every entity is interconnected through relations:
 *   Role  -> RolePermission -> Permission
 *   Role  -> GroupRole      -> Group
 *   User  -> UserRole       -> Role
 *   User  -> UserGroup      -> Group
 *
 * TypeORM needs the complete closure registered to resolve inverse relation
 * metadata (e.g. Role#rolePermissions). Specs only declare which repositories
 * they exercise; we always register the full set so DataSource initialization,
 * cleanDatabase() and app.close() never fail on missing metadata.
 */
const ALL_ENTITIES = [User, Role, UserRole, Permission, RolePermission, Group, GroupRole, UserGroup];

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

    // Always register the full entity graph so TypeORM can resolve every
    // inverse relation, regardless of which subset a spec declares.
    const entities = Array.from(new Set([...ALL_ENTITIES, ...config.entities]));

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
                entities,
                synchronize: true,
            }),
            TypeOrmModule.forFeature(entities),
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
