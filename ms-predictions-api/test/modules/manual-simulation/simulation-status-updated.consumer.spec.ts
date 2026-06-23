import { Logger } from 'nestjs-pino';
import { SimulationStatusUpdatedConsumer } from '../../../src/app/application/consumers/simulation-status-updated.consumer';
import { ISimulationRepository } from '../../../src/app/domain/ports/simulation-repository.port';
import { ICacheService } from '../../../src/app/domain/ports/cache-service.port';
import {
    Simulation,
    SimulationStatus,
    SimulationType,
    DataOrigin,
} from '../../../src/app/domain/entities/simulation.entity';

describe('SimulationStatusUpdatedConsumer', () => {
    let consumer: SimulationStatusUpdatedConsumer;
    let simulationRepository: jest.Mocked<ISimulationRepository>;
    let cacheService: jest.Mocked<ICacheService>;
    let mockLogger: jest.Mocked<Logger>;

    const mockChannel = {
        ack: jest.fn(),
        nack: jest.fn(),
    };

    const mockContext = {
        getChannelRef: jest.fn().mockReturnValue(mockChannel),
        getMessage: jest.fn().mockReturnValue({ properties: { headers: {} } }),
    };

    beforeEach(() => {
        simulationRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByDate: jest.fn(),
            findByDateAndEnvAndModmeteo: jest.fn(),
            findLatestFinalized: jest.fn(),
            findAll: jest.fn(),
            findHistorical: jest.fn(),
            update: jest.fn(),
            findAvailableDates: jest.fn(),
            deleteOlderThan: jest.fn(),
            findManual: jest.fn(),
        } as jest.Mocked<ISimulationRepository>;

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

        consumer = new SimulationStatusUpdatedConsumer(mockLogger, simulationRepository, cacheService);

        jest.clearAllMocks();
        mockChannel.ack.mockClear();
        mockChannel.nack.mockClear();
        mockContext.getChannelRef.mockReturnValue(mockChannel);
        mockContext.getMessage.mockReturnValue({ properties: { headers: {} } });
    });

    it('should call simulation.fail() and update when simulationId exists', async () => {
        const simulationId = 'test-uuid-1234';
        const simulation = new Simulation({
            id: simulationId,
            simulationDate: '20260619120000',
            status: SimulationStatus.MODEL_PROCESSING,
            type: SimulationType.MANUAL,
            dataOrigin: DataOrigin.FORECAST,
        });

        simulationRepository.findById.mockResolvedValue(simulation);
        simulationRepository.update.mockResolvedValue(simulation);

        await consumer.handle({ simulationId, status: 'MODEL_FAILED' }, mockContext as any);

        expect(simulationRepository.findById).toHaveBeenCalledWith(simulationId);
        expect(simulation.status).toBe(SimulationStatus.MODEL_FAILED);
        expect(simulationRepository.update).toHaveBeenCalledWith(simulation);
        // A status change must invalidate BOTH simulation cache namespaces.
        expect(cacheService.delByPattern).toHaveBeenCalledWith('simulations:*');
        expect(cacheService.delByPattern).toHaveBeenCalledWith('manual-simulation:*');
        expect(cacheService.delByPattern).toHaveBeenCalledTimes(2);
        expect(mockChannel.ack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should ack without crash when simulationId is not found', async () => {
        const simulationId = 'non-existent-uuid';

        simulationRepository.findById.mockRejectedValue(new Error('Simulation not found'));

        await consumer.handle({ simulationId, status: 'MODEL_FAILED' }, mockContext as any);

        expect(mockChannel.ack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack).not.toHaveBeenCalled();
    });
});
