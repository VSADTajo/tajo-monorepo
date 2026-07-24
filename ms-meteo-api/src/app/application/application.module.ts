import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { CachingQueryBus } from '@infrastructure/cache/caching-query-bus.service';

// Controllers
import { MeteoController } from '@api/controllers/meteo.controller';
import { AerialPrecipitationController } from '@api/controllers/aerial-precipitation.controller';

// Services
import { MeteoDiscoveryService } from '@application/services/meteo-discovery.service';
import { DatasetMutex } from '@application/services/dataset-mutex';
import { ImageMosaicBootstrapService } from '@application/services/image-mosaic-bootstrap.service';
import { MeteoSyncScheduler } from '@application/services/meteo-sync.scheduler';
import { MeteoAggregationService } from '@application/services/meteo-aggregation.service';
import { AerialPrecipitationPollerScheduler } from '@application/services/aerial-precipitation-poller.scheduler';
import { AerialPrecipitationRetentionScheduler } from '@application/services/aerial-precipitation-retention.scheduler';

// Commands
import {
    AccumulateMeteoHandler,
    PurgeMeteoGranulesHandler,
    SyncMeteoHandler,
} from '@application/commands/meteo.commands';
import {
    PollAerialPrecipitationHandler,
    PurgeOldAerialPrecipitationHandler,
} from '@application/commands/aerial-precipitation.commands';

// Queries
import { MeteoInfoHandler, MeteoProvidersHandler } from '@application/queries/meteo.queries';
import { GetAvisosHandler, GetAvisosResumenHandler, GetAvisosTiposHandler } from '@application/queries/avisos.queries';
import {
    GetAerialPrecipitationLatestHandler,
    GetAerialPrecipitationByLocationHandler,
    ListAerialPrecipitationHandler,
} from '@application/queries/aerial-precipitation.queries';

/**
 * Application Module - Use Cases Layer
 *
 * Registers handlers + controllers + consumers as per CLAUDE.md conventions.
 */
@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [MeteoController, AerialPrecipitationController],
    providers: [
        // Application Services
        MeteoDiscoveryService,
        DatasetMutex,
        ImageMosaicBootstrapService,
        MeteoSyncScheduler,
        MeteoAggregationService,
        AerialPrecipitationPollerScheduler,
        AerialPrecipitationRetentionScheduler,
        // Command Handlers
        SyncMeteoHandler,
        PurgeMeteoGranulesHandler,
        AccumulateMeteoHandler,
        PollAerialPrecipitationHandler,
        PurgeOldAerialPrecipitationHandler,
        // Query Handlers
        MeteoInfoHandler,
        MeteoProvidersHandler,
        GetAvisosHandler,
        GetAvisosResumenHandler,
        GetAvisosTiposHandler,
        GetAerialPrecipitationLatestHandler,
        GetAerialPrecipitationByLocationHandler,
        ListAerialPrecipitationHandler,
        // Cache
        CachingQueryBus,
    ],
    exports: [MeteoDiscoveryService, DatasetMutex],
})
export class ApplicationModule {}
