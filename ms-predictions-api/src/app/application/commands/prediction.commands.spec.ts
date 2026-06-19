import { ProcessTimeSeriesCommand, ProcessTimeSeriesHandler } from './prediction.commands';
import { ISimulationRepository } from '../../domain/ports/simulation-repository.port';
import { IPredictionRepository } from '../../domain/ports/prediction-repository.port';
import { IPredictionTypeRepository } from '../../domain/ports/prediction-type-repository.port';
import { IPredictionResultRepository } from '../../domain/ports/prediction-result-repository.port';
import { IStationThresholdService } from '../../domain/ports/station-threshold-service.port';
import { ICacheService } from '../../domain/ports/cache-service.port';
import { IMessageBroker } from '../../domain/ports/message-broker.port';
import { Simulation, SimulationStatus, SimulationType, DataOrigin } from '../../domain/entities/simulation.entity';
import { PredictionType } from '../../domain/entities/prediction-type.entity';
import { Prediction } from '../../domain/entities/prediction.entity';
import { PredictionResult } from '../../domain/entities/prediction-result.entity';
import { Logger } from 'nestjs-pino';

describe('ProcessTimeSeriesHandler — simulationId direct lookup', () => {
    let handler: ProcessTimeSeriesHandler;
    let simulationRepository: jest.Mocked<ISimulationRepository>;
    let predictionRepository: jest.Mocked<IPredictionRepository>;
    let predictionTypeRepository: jest.Mocked<IPredictionTypeRepository>;
    let predictionResultRepository: jest.Mocked<IPredictionResultRepository>;
    let stationThresholdService: jest.Mocked<IStationThresholdService>;
    let cacheService: jest.Mocked<ICacheService>;
    let messageBroker: jest.Mocked<IMessageBroker>;
    let mockLogger: jest.Mocked<Logger>;

    const mockSimulation = new Simulation({
        id: 'manual-sim-uuid',
        simulationDate: '20260619120000',
        status: SimulationStatus.MODEL_PROCESSING,
        type: SimulationType.MANUAL,
        dataOrigin: DataOrigin.FORECAST,
    });

    const mockPredictionType = Object.assign(new PredictionType(), {
        id: 'pred-type-uuid',
        name: 'Q.sim.forecast',
        units: 'm3/s',
    });

    const mockPrediction = new Prediction({
        id: 'pred-uuid',
        stationId: 'E001',
        predictionTypeId: 'pred-type-uuid',
        simulationId: 'manual-sim-uuid',
    });

    const mockPredictionResult = Object.assign(new PredictionResult(), {
        id: 'result-uuid',
        predictionId: 'pred-uuid',
        date: new Date(),
        value: 12.5,
        flag: 0,
    });

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

        predictionRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findHistorical: jest.fn(),
            findBySimulationId: jest.fn(),
            findByProviderAndDate: jest.fn(),
            findForecast: jest.fn(),
            findMaxAndLatestValues: jest.fn(),
            findSimulationDatesByStation: jest.fn(),
            findByUniqueConstraint: jest.fn(),
        } as jest.Mocked<IPredictionRepository>;

        predictionTypeRepository = {
            findOrCreateByName: jest.fn(),
            findAll: jest.fn(),
        } as unknown as jest.Mocked<IPredictionTypeRepository>;

        predictionResultRepository = {
            bulkCreate: jest.fn(),
            findByPredictionId: jest.fn(),
        } as unknown as jest.Mocked<IPredictionResultRepository>;

        stationThresholdService = {
            getThreshold: jest.fn(),
        } as jest.Mocked<IStationThresholdService>;

        cacheService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn(),
        } as jest.Mocked<ICacheService>;

        messageBroker = {
            publish: jest.fn(),
            publishToTopic: jest.fn(),
        } as jest.Mocked<IMessageBroker>;

        mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        handler = new ProcessTimeSeriesHandler(
            mockLogger,
            predictionTypeRepository,
            simulationRepository,
            predictionRepository,
            predictionResultRepository,
            stationThresholdService,
            cacheService,
            messageBroker,
        );

        predictionTypeRepository.findOrCreateByName.mockResolvedValue(mockPredictionType);
        predictionRepository.findByUniqueConstraint.mockResolvedValue(null);
        predictionRepository.create.mockResolvedValue(mockPrediction);
        predictionResultRepository.bulkCreate.mockResolvedValue([mockPredictionResult]);
        stationThresholdService.getThreshold.mockResolvedValue(null);
        cacheService.delByPattern.mockResolvedValue(undefined);
    });

    it('should find simulation by ID when simulationId is provided directly', async () => {
        simulationRepository.findById.mockResolvedValue(mockSimulation);
        simulationRepository.update.mockResolvedValue(mockSimulation);

        const command = new ProcessTimeSeriesCommand({
            simulationId: 'manual-sim-uuid',
            series: {
                locationId: 'E001',
                parameterId: 'Q.sim.forecast',
                moduleInstanceId: 'MANUAL',
                forecastDate: '2026-06-19T12:00:00Z',
                startDate: '2026-06-19T12:00:00Z',
                endDate: '2026-06-20T12:00:00Z',
                events: [{ timestamp: '2026-06-19T12:00:00Z', value: 12.5, flag: 0 }],
            },
        });

        const result = await handler.execute(command);

        expect(simulationRepository.findById).toHaveBeenCalledWith('manual-sim-uuid');
        expect(simulationRepository.findByDateAndEnvAndModmeteo).not.toHaveBeenCalled();
        expect(result.simulationId).toBe('manual-sim-uuid');
    });

    it('should link predictions to the manual simulationId', async () => {
        simulationRepository.findById.mockResolvedValue(mockSimulation);
        simulationRepository.update.mockResolvedValue(mockSimulation);

        const command = new ProcessTimeSeriesCommand({
            simulationId: 'manual-sim-uuid',
            series: {
                locationId: 'E001',
                parameterId: 'Q.sim.forecast',
                moduleInstanceId: 'MANUAL',
                forecastDate: '2026-06-19T12:00:00Z',
                startDate: '2026-06-19T12:00:00Z',
                events: [{ timestamp: '2026-06-19T12:00:00Z', value: 12.5 }],
            },
        });

        await handler.execute(command);

        const createdPredictionCall = predictionRepository.create.mock.calls[0][0];
        expect(createdPredictionCall.simulationId).toBe('manual-sim-uuid');
    });
});
