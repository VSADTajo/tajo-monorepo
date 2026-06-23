import { Controller, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { TraceContext, extractTraceId } from 'tajo-toolkit';

import { Topics } from '@infrastructure/messaging/messaging.registry';
import { SimulationStatusNotificationMapper } from '@application/mappers/notification.mappers';

interface SimulationStatusUpdatedEvent {
    simulationId?: string;
    status?: string;
}

@Controller()
export class SimulationStatusConsumer {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly traceContext: TraceContext,
    ) {}

    @EventPattern(Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED)
    async handleSimulationStatusUpdated(
        @Payload() data: SimulationStatusUpdatedEvent,
        @Ctx() context: RmqContext,
    ): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        // Continue the trace from the incoming message (or start a new one)
        const traceId = extractTraceId(originalMsg.properties?.headers);

        await this.traceContext.runInContext(traceId, async () => {
            try {
                this.logger.log({
                    msg: 'Received simulation.status.updated',
                    entity: 'Notifications',
                    simulationId: data.simulationId,
                    status: data.status,
                });

                if (!data.simulationId || !data.status) {
                    this.logger.error({
                        msg: 'Invalid simulation.status.updated payload — rejecting without requeue',
                        entity: 'Notifications',
                        payload: JSON.stringify(data),
                    });
                    channel.nack(originalMsg, false, false); // poison message — do not requeue
                    return;
                }

                const command = SimulationStatusNotificationMapper.fromEvent(data.simulationId, data.status);
                await this.commandBus.execute(command);

                channel.ack(originalMsg);
                this.logger.log({
                    msg: 'Notification created for simulation status change',
                    entity: 'Notifications',
                    simulationId: data.simulationId,
                    status: data.status,
                });
            } catch (error) {
                this.logger.error({
                    msg: 'Failed to process simulation.status.updated — requeue on transient error',
                    entity: 'Notifications',
                    error: String(error),
                });
                channel.nack(originalMsg, false, true); // requeue on processing error
            }
        });
    }
}
