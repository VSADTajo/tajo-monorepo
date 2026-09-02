import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AppConfigModule } from '@config/app/app-config.module';

// Command Handlers
import { ProcessTimeSeriesHandler } from '@application/commands/prediction.commands';
import {
    FinalizeSimulationHandler,
    DeleteSimulationHandler,
    BatchIngestHandler,
} from '@application/commands/simulation.commands';
import { CreatePredictionTypeHandler } from '@application/commands/prediction-type.commands';
import { PurgeOldSimulationsHandler } from '@application/commands/cleanup.commands';
import { CreateManualSimulationHandler } from '@application/commands/manual-simulation.commands';
import {
    CreateManeuverHandler,
    UpdateManeuverHandler,
    DeleteManeuverHandler,
} from '@application/commands/maneuver.commands';

// Services
import { CleanupScheduler } from '@application/services/cleanup.scheduler';

// Query Handlers
import {
    ListSimulationsHandler,
    GetSimulationByDateHandler,
    GetLatestSimulationHandler,
    GetHistoricalSimulationsHandler,
    GetAvailableDatesHandler,
    GetSimulationFilesHandler,
    DownloadSimulationFileHandler,
} from '@application/queries/simulation.queries';
import {
    GetHistoricalPredictionsHandler,
    GetRawPredictionsHandler,
    GetForecastPredictionsHandler,
    GetMaxAndLatestValuesHandler,
    GetSimulationDatesByStationHandler,
} from '@application/queries/prediction.queries';
import {
    ListPredictionTypesHandler,
    ListStationPredictionTypesHandler,
    GetTypeCoverageMatrixHandler,
} from '@application/queries/prediction-type.queries';
import {
    GetManualSimulationByIdHandler,
    ListManualSimulationsHandler,
    GetSimulationResultsHandler,
} from '@application/queries/manual-simulation.queries';
import { ListManeuversHandler, GetManeuverByIdHandler } from '@application/queries/maneuver.queries';

// Controllers
import { SimulationController } from '@api/controllers/simulation.controller';
import { PredictionController } from '@api/controllers/prediction.controller';
import { PredictionTypeController } from '@api/controllers/prediction-type.controller';
import { ManeuverController } from '@api/controllers/maneuver.controller';

// Consumers
import { TimeSeriesIngestedConsumer } from '@application/consumers/timeseries-ingested.consumer';
import { SimulationStatusUpdatedConsumer } from '@application/consumers/simulation-status-updated.consumer';
import { SimulationManualBalanceComputedConsumer } from '@application/consumers/simulation-manual-balance-computed.consumer';

@Module({
    imports: [CqrsModule, InfrastructureModule, AppConfigModule],
    controllers: [
        SimulationController,
        PredictionController,
        PredictionTypeController,
        ManeuverController,
        TimeSeriesIngestedConsumer,
        SimulationStatusUpdatedConsumer,
        SimulationManualBalanceComputedConsumer,
    ],
    providers: [
        ProcessTimeSeriesHandler,
        FinalizeSimulationHandler,
        DeleteSimulationHandler,
        CreateManualSimulationHandler,
        CreateManeuverHandler,
        UpdateManeuverHandler,
        DeleteManeuverHandler,
        ListManeuversHandler,
        GetManeuverByIdHandler,
        ListSimulationsHandler,
        GetSimulationByDateHandler,
        GetLatestSimulationHandler,
        GetHistoricalSimulationsHandler,
        GetAvailableDatesHandler,
        GetSimulationFilesHandler,
        DownloadSimulationFileHandler,
        GetHistoricalPredictionsHandler,
        GetRawPredictionsHandler,
        GetForecastPredictionsHandler,
        GetMaxAndLatestValuesHandler,
        GetSimulationDatesByStationHandler,
        GetManualSimulationByIdHandler,
        ListManualSimulationsHandler,
        GetSimulationResultsHandler,
        BatchIngestHandler,
        ListPredictionTypesHandler,
        ListStationPredictionTypesHandler,
        GetTypeCoverageMatrixHandler,
        CreatePredictionTypeHandler,
        PurgeOldSimulationsHandler,
        CleanupScheduler,
    ],
})
export class ApplicationModule {}
