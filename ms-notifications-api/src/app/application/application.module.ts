import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Infrastructure
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Consumers
import { NotificationConsumer } from '@application/consumers/notification.consumer';
import { SimulationStatusConsumer } from '@application/consumers/simulation-status.consumer';

// Notification Handlers
import {
    CreateNotificationHandler,
    MarkAsReadHandler,
    ArchiveNotificationHandler,
    BulkMarkAsReadHandler,
    BulkArchiveHandler,
} from '@application/commands/notification.commands';
import { ListNotificationsHandler } from '@application/queries/notification.queries';

// Notification Controller
import { NotificationController } from '@api/controllers/notification.controller';

@Module({
    imports: [CqrsModule, InfrastructureModule],
    controllers: [NotificationConsumer, SimulationStatusConsumer, NotificationController],
    providers: [
        CreateNotificationHandler,
        MarkAsReadHandler,
        ArchiveNotificationHandler,
        BulkMarkAsReadHandler,
        BulkArchiveHandler,
        ListNotificationsHandler,
    ],
})
export class ApplicationModule {}
