import { Logger } from 'nestjs-pino';

import { SimulationRun } from '../../domain/entities/simulation-run.entity';
import { ISimulationRunRepository } from '../../domain/ports/simulation-run-repository.port';
import { SimulationRunStatus } from '../../domain/types/simulation-run-status.enum';
import { RegisterSimulationRunCommand, RegisterSimulationRunHandler } from './simulation-run.commands';

const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const mockSimulationRunRepository = {
    create: jest.fn(),
    findBySimulationId: jest.fn(),
    findWaitingResult: jest.fn(),
    update: jest.fn(),
};

describe('RegisterSimulationRunHandler', () => {
    let handler: RegisterSimulationRunHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new RegisterSimulationRunHandler(
            mockLogger as unknown as Logger,
            mockSimulationRunRepository as unknown as ISimulationRunRepository,
        );
    });

    it('should create a SimulationRun with status WAITING_RESULT when simulationId does not exist', async () => {
        const simulationId = '11111111-1111-1111-1111-111111111111';
        const outputFolder = '/simulations/test/output/';

        mockSimulationRunRepository.findBySimulationId.mockResolvedValue(null);
        mockSimulationRunRepository.create.mockImplementation(async (run: SimulationRun) => ({
            ...run,
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        }));

        const command = new RegisterSimulationRunCommand({ simulationId, outputFolder });
        const result = await handler.execute(command);

        expect(mockSimulationRunRepository.findBySimulationId).toHaveBeenCalledWith(simulationId);
        expect(mockSimulationRunRepository.create).toHaveBeenCalledTimes(1);

        const createdRun: SimulationRun = mockSimulationRunRepository.create.mock.calls[0][0];
        expect(createdRun.simulationId).toBe(simulationId);
        expect(createdRun.outputFolder).toBe(outputFolder);
        expect(createdRun.status).toBe(SimulationRunStatus.WAITING_RESULT);
        expect(createdRun.startedAt).toBeInstanceOf(Date);

        expect(result.simulationId).toBe(simulationId);
        expect(result.status).toBe(SimulationRunStatus.WAITING_RESULT);
    });

    it('should skip creation when SimulationRun with same simulationId already exists (idempotency)', async () => {
        const simulationId = '22222222-2222-2222-2222-222222222222';
        const outputFolder = '/simulations/test/output/';

        const existingRun = new SimulationRun({
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            simulationId,
            outputFolder,
            status: SimulationRunStatus.WAITING_RESULT,
            startedAt: new Date(),
            completedAt: null,
            errorMessage: null,
        });

        mockSimulationRunRepository.findBySimulationId.mockResolvedValue(existingRun);

        const command = new RegisterSimulationRunCommand({ simulationId, outputFolder });
        const result = await handler.execute(command);

        expect(mockSimulationRunRepository.findBySimulationId).toHaveBeenCalledWith(simulationId);
        expect(mockSimulationRunRepository.create).not.toHaveBeenCalled();

        expect(result.simulationId).toBe(simulationId);
        expect(result.id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    });
});
