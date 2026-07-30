import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Handlers
import { SyncGeoserverHandler } from '@application/commands/sync.commands';
import {
    CreateBasinHandler,
    UpdateBasinHandler,
    ToggleBasinHandler,
    DeleteBasinHandler,
} from '@application/commands/basin.commands';
import {
    CreateSubBasinHandler,
    UpdateSubBasinHandler,
    ToggleSubBasinHandler,
    DeleteSubBasinHandler,
} from '@application/commands/sub-basin.commands';
import {
    CreateStationHandler,
    UpdateStationThresholdHandler,
    UpdateStationHandler,
    ToggleStationHandler,
    DeleteStationHandler,
    ImportStationsHandler,
} from '@application/commands/station.commands';
import { ImportResguardosHandler, UpdateResguardoHandler } from '@application/commands/resguardo.commands';
import { CreateScenarioHandler, DeleteScenarioHandler } from '@application/commands/scenario.commands';

// Query Handlers
import { GetBasinByIdHandler, ListBasinsHandler } from '@application/queries/basin.queries';
import { GetSubBasinByIdHandler, ListSubBasinsHandler } from '@application/queries/sub-basin.queries';
import {
    GetStationByIdHandler,
    GetStationBySubBasinNameHandler,
    GetStationByCodeHandler,
    GetStationThresholdHandler,
    ListStationsHandler,
    GetDownstreamStationsHandler,
} from '@application/queries/station.queries';
import { SearchGeoDataHandler } from '@application/queries/geo-data.queries';
import { GetResguardosByStationHandler, GetResguardoByDateHandler } from '@application/queries/resguardo.queries';
import { GetScenarioByIdHandler, ListScenariosHandler } from '@application/queries/scenario.queries';

// Controllers
import { BasinController } from '@api/controllers/basin.controller';
import { SubBasinController } from '@api/controllers/sub-basin.controller';
import { StationController } from '@api/controllers/station.controller';
import { SyncController } from '@api/controllers/sync.controller';
import { GeoDataController } from '@api/controllers/geo-data.controller';
import { ResguardoController } from '@api/controllers/resguardo.controller';
import { ScenarioController } from '@api/controllers/scenario.controller';

@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [
        BasinController,
        SubBasinController,
        StationController,
        SyncController,
        GeoDataController,
        ResguardoController,
        ScenarioController,
    ],
    providers: [
        SyncGeoserverHandler,
        CreateBasinHandler,
        UpdateBasinHandler,
        ToggleBasinHandler,
        GetBasinByIdHandler,
        ListBasinsHandler,
        CreateSubBasinHandler,
        UpdateSubBasinHandler,
        ToggleSubBasinHandler,
        GetSubBasinByIdHandler,
        ListSubBasinsHandler,
        CreateStationHandler,
        ImportStationsHandler,
        UpdateStationThresholdHandler,
        GetStationByIdHandler,
        GetStationBySubBasinNameHandler,
        GetStationByCodeHandler,
        GetStationThresholdHandler,
        ListStationsHandler,
        UpdateStationHandler,
        ToggleStationHandler,
        DeleteBasinHandler,
        DeleteSubBasinHandler,
        DeleteStationHandler,
        SearchGeoDataHandler,
        ImportResguardosHandler,
        UpdateResguardoHandler,
        GetResguardosByStationHandler,
        GetResguardoByDateHandler,
        GetDownstreamStationsHandler,
        CreateScenarioHandler,
        DeleteScenarioHandler,
        GetScenarioByIdHandler,
        ListScenariosHandler,
    ],
})
export class ApplicationModule {}
