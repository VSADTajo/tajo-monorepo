import { FinalizeSimulationHandler, FinalizeSimulationCommand } from './simulation.commands';
import { ISimulationRepository } from '../../domain/ports/simulation-repository.port';
import { ICacheService } from '../../domain/ports/cache-service.port';
import { Simulation, SimulationStatus, SimulationType, DataOrigin } from '../../domain/entities/simulation.entity';
import { ApiError } from '../../domain/errors/api.error';
import { RepositoryError } from '../../domain/errors/repository.error';
import { Logger } from 'nestjs-pino';

describe('FinalizeSimulationHandler — cache invalidation on status change', () => {
    let handler: FinalizeSimulationHandler;
    let simulationRepository: jest.Mocked<ISimulationRepository>;
    let cacheService: jest.Mocked<ICacheService>;
    let mockLogger: jest.Mocked<Logger>;

    const buildSimulation = (status: SimulationStatus) =>
        new Simulation({
            id: 'sim-uuid',
            simulationDate: '20260619120000',
            status,
            type: SimulationType.MANUAL,
            dataOrigin: DataOrigin.FORECAST,
        });

    beforeEach(() => {
        simulationRepository = {
            findById: jest.fn(),
            update: jest.fn(),
        } as unknown as jest.Mocked<ISimulationRepository>;

        cacheService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn().mockResolvedValue(undefined),
        } as jest.Mocked<ICacheService>;

        mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        handler = new FinalizeSimulationHandler(mockLogger, simulationRepository, cacheService);
    });

    it('invalidates BOTH the general and manual simulation cache namespaces', async () => {
        const simulation = buildSimulation(SimulationStatus.IN_PROGRESS);
        simulationRepository.findById.mockResolvedValue(simulation);
        simulationRepository.update.mockResolvedValue(simulation);

        await handler.execute(new FinalizeSimulationCommand({ id: 'sim-uuid' }));

        // The reported bug: only 'simulations:*' was cleared, leaving 'manual-simulation:*' stale.
        expect(cacheService.delByPattern).toHaveBeenCalledWith('simulations:*');
        expect(cacheService.delByPattern).toHaveBeenCalledWith('manual-simulation:*');
        expect(cacheService.delByPattern).toHaveBeenCalledTimes(2);
    });

    it('does NOT persist or touch the cache when the simulation cannot be loaded', async () => {
        simulationRepository.findById.mockRejectedValue(new RepositoryError('db down', new Error('conn refused')));

        await expect(handler.execute(new FinalizeSimulationCommand({ id: 'missing-uuid' }))).rejects.toBeInstanceOf(
            ApiError,
        );

        expect(simulationRepository.update).not.toHaveBeenCalled();
        expect(cacheService.delByPattern).not.toHaveBeenCalled();
    });
});
