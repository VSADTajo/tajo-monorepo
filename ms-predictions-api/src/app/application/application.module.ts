import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Handlers
import { ProcessTimeSeriesHandler } from '@application/commands/prediction.commands';
import { FinalizeSimulationHandler, BatchIngestHandler } from '@application/commands/simulation.commands';
import { CreatePredictionTypeHandler } from '@application/commands/prediction-type.commands';
import { PurgeOldSimulationsHandler } from '@application/commands/cleanup.commands';

// Services
import { CleanupScheduler } from '@application/services/cleanup.scheduler';

// Query Handlers
import {
    ListSimulationsHandler,
    GetSimulationByDateHandler,
    GetLatestSimulationHandler,
    GetHistoricalSimulationsHandler,
    GetAvailableDatesHandler,
} from '@application/queries/simulation.queries';
import {
    GetHistoricalPredictionsHandler,
    GetRawPredictionsHandler,
    GetForecastPredictionsHandler,
    GetMaxAndLatestValuesHandler,
    GetSimulationDatesByStationHandler,
} from '@application/queries/prediction.queries';
import { ListPredictionTypesHandler } from '@application/queries/prediction-type.queries';

// Controllers
import { SimulationController } from '@api/controllers/simulation.controller';
import { PredictionController } from '@api/controllers/prediction.controller';
import { PredictionTypeController } from '@api/controllers/prediction-type.controller';

// Consumers
import { TimeSeriesIngestedConsumer } from '@application/consumers/timeseries-ingested.consumer';

@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [SimulationController, PredictionController, PredictionTypeController, TimeSeriesIngestedConsumer],
    providers: [
        ProcessTimeSeriesHandler,
        FinalizeSimulationHandler,
        ListSimulationsHandler,
        GetSimulationByDateHandler,
        GetLatestSimulationHandler,
        GetHistoricalSimulationsHandler,
        GetAvailableDatesHandler,
        GetHistoricalPredictionsHandler,
        GetRawPredictionsHandler,
        GetForecastPredictionsHandler,
        GetMaxAndLatestValuesHandler,
        GetSimulationDatesByStationHandler,
        BatchIngestHandler,
        ListPredictionTypesHandler,
        CreatePredictionTypeHandler,
        PurgeOldSimulationsHandler,
        CleanupScheduler,
    ],
})
export class ApplicationModule {}
