import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Handlers
import {
    CreateProviderConfigHandler,
    UpdateProviderConfigHandler,
    DeleteProviderConfigHandler,
    ToggleProviderConfigHandler,
} from '@application/commands/provider-config.commands';
import { ExecuteIngestionHandler, TriggerIngestionHandler } from '@application/commands/ingestion.commands';
import { PurgeOldIngestionRunsHandler } from '@application/commands/cleanup.commands';
import { RegisterSimulationRunHandler, AttachFewsTaskHandler } from '@application/commands/simulation-run.commands';

// Query Handlers
import { ListProviderConfigsHandler, GetProviderConfigByIdHandler } from '@application/queries/provider-config.queries';
import { ListIngestionRunsHandler, GetIngestionRunByIdHandler } from '@application/queries/ingestion-run.queries';

// Controllers
import { ProviderConfigController } from '@api/controllers/provider-config.controller';
import { IngestionRunController } from '@api/controllers/ingestion-run.controller';
import { MockFewsController } from '@api/controllers/mock-fews.controller';
import { MockWiskiController } from '@api/controllers/mock-wiski.controller';

@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [
        ProviderConfigController,
        IngestionRunController,
        MockFewsController,
        MockWiskiController,
    ],
    providers: [
        CreateProviderConfigHandler,
        UpdateProviderConfigHandler,
        DeleteProviderConfigHandler,
        ToggleProviderConfigHandler,
        ListProviderConfigsHandler,
        GetProviderConfigByIdHandler,
        ListIngestionRunsHandler,
        GetIngestionRunByIdHandler,
        ExecuteIngestionHandler,
        TriggerIngestionHandler,
        PurgeOldIngestionRunsHandler,
        RegisterSimulationRunHandler,
        AttachFewsTaskHandler,
    ],
})
export class ApplicationModule {}
