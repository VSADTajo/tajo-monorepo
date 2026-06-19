import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Entities
import { SimulationRun } from '../../../src/app/domain/entities/simulation-run.entity';

// Ports
import { ISimulationRunRepository } from '../../../src/app/domain/ports/simulation-run-repository.port';

// Implementations
import { SimulationRunRepository } from '../../../src/app/infrastructure/persistence/simulation-run.repository';

// Handlers and Commands
import {
    RegisterSimulationRunCommand,
    RegisterSimulationRunHandler,
} from '../../../src/app/application/commands/simulation-run.commands';
import { SimulationRunStatus } from '../../../src/app/domain/types/simulation-run-status.enum';

// Helpers
import { createTestApp, TestContext } from '../../helpers/test-app.helper';
import { cleanDatabase } from '../../helpers/db.helper';

describe('RegisterSimulationRun (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let pgContainer: StartedPostgreSqlContainer;
    let commandBus: CommandBus;
    let simulationRunRepository: ISimulationRunRepository;

    beforeAll(async () => {
        const ctx: TestContext = await createTestApp({
            entities: [SimulationRun],
            controllers: [],
            providers: [
                RegisterSimulationRunHandler,
                { provide: ISimulationRunRepository, useClass: SimulationRunRepository },
            ],
        });

        app = ctx.app;
        dataSource = ctx.dataSource;
        pgContainer = ctx.pgContainer;
        commandBus = app.get(CommandBus);
        simulationRunRepository = app.get(ISimulationRunRepository);
    }, 60_000);

    afterEach(async () => {
        await cleanDatabase(dataSource);
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
        await pgContainer.stop();
    });

    it('should create a SimulationRun with status WAITING_RESULT via command bus', async () => {
        const simulationId = '11111111-1111-1111-1111-111111111111';
        const outputFolder = '/simulations/test/output/';

        const result = await commandBus.execute(new RegisterSimulationRunCommand({ simulationId, outputFolder }));

        expect(result.simulationId).toBe(simulationId);
        expect(result.outputFolder).toBe(outputFolder);
        expect(result.status).toBe(SimulationRunStatus.WAITING_RESULT);
        expect(result.id).toBeDefined();
        expect(result.startedAt).toBeInstanceOf(Date);
        expect(result.completedAt).toBeNull();
        expect(result.errorMessage).toBeNull();

        // Verify persisted to DB
        const persisted = await simulationRunRepository.findBySimulationId(simulationId);
        expect(persisted).not.toBeNull();
        expect(persisted!.simulationId).toBe(simulationId);
        expect(persisted!.status).toBe(SimulationRunStatus.WAITING_RESULT);
    });

    it('should be idempotent — second call with same simulationId does not create a duplicate', async () => {
        const simulationId = '22222222-2222-2222-2222-222222222222';
        const outputFolder = '/simulations/test/output/';

        const firstResult = await commandBus.execute(new RegisterSimulationRunCommand({ simulationId, outputFolder }));

        const secondResult = await commandBus.execute(new RegisterSimulationRunCommand({ simulationId, outputFolder }));

        // Same id — no duplicate created
        expect(secondResult.id).toBe(firstResult.id);
        expect(secondResult.simulationId).toBe(simulationId);

        // Verify only one record in DB
        const allWaiting = await simulationRunRepository.findWaitingResult();
        const forThisSimulation = allWaiting.filter((r) => r.simulationId === simulationId);
        expect(forThisSimulation.length).toBe(1);
    });
});
