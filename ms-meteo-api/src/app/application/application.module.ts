import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Controllers
import { MeteoController } from '@api/controllers/meteo.controller';

// Services
import { MeteoDiscoveryService } from '@application/services/meteo-discovery.service';
import { DatasetMutex } from '@application/services/dataset-mutex';
import { ImageMosaicBootstrapService } from '@application/services/image-mosaic-bootstrap.service';
import { MeteoSyncScheduler } from '@application/services/meteo-sync.scheduler';
import { MeteoAggregationService } from '@application/services/meteo-aggregation.service';

// Commands
import {
    AccumulateMeteoHandler,
    PurgeMeteoGranulesHandler,
    SyncMeteoHandler,
} from '@application/commands/meteo.commands';

// Queries
import { MeteoInfoHandler, MeteoProvidersHandler } from '@application/queries/meteo.queries';
import { GetAvisosHandler, GetAvisosResumenHandler, GetAvisosTiposHandler } from '@application/queries/avisos.queries';

/**
 * Application Module - Use Cases Layer
 *
 * Registers handlers + controllers + consumers as per CLAUDE.md conventions.
 */
@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [MeteoController],
    providers: [
        // Application Services
        MeteoDiscoveryService,
        DatasetMutex,
        ImageMosaicBootstrapService,
        MeteoSyncScheduler,
        MeteoAggregationService,
        // Command Handlers
        SyncMeteoHandler,
        PurgeMeteoGranulesHandler,
        AccumulateMeteoHandler,
        // Query Handlers
        MeteoInfoHandler,
        MeteoProvidersHandler,
        GetAvisosHandler,
        GetAvisosResumenHandler,
        GetAvisosTiposHandler,
    ],
    exports: [MeteoDiscoveryService, DatasetMutex],
})
export class ApplicationModule {}
