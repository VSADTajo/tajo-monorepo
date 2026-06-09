import { Controller, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { CreateNotificationMapper } from '@application/mappers/notification.mappers';

@Controller()
export class NotificationConsumer {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
    ) {}

    @EventPattern('notification.created')
    async handleNotificationCreated(
        @Payload() data: Record<string, unknown>,
        @Ctx() context: RmqContext,
    ): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            this.logger.log(`Received notification event: type=${data.type}, source=${data.source}`);

            if (!data.type || !data.source || !data.title || !data.message || !data.severity) {
                this.logger.error({
                    msg: 'Invalid notification payload',
                    entity: 'Notifications',
                    payload: JSON.stringify(data),
                });
                channel.nack(originalMsg, false, false); // reject without requeue
                return;
            }

            const command = CreateNotificationMapper.fromPayload(data);
            await this.commandBus.execute(command);

            channel.ack(originalMsg);
            this.logger.log({
                msg: 'Notification created',
                entity: 'Notifications',
                type: data.type,
                source: data.source,
            });
        } catch (error) {
            this.logger.error({
                msg: 'Failed to process notification event',
                entity: 'Notifications',
                error: String(error),
            });
            channel.nack(originalMsg, false, true); // requeue on processing error
        }
    }
}
