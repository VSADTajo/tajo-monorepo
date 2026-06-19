import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IMessageBroker } from '@domain/ports/message-broker.port';
import { RegisterSimulationRunCommand } from '@application/commands/simulation-run.commands';
import { Queues, Topics } from '@infrastructure/messaging/messaging.registry';

interface SimulationManualDispatchedPayload {
    simulationId: string;
    outputFolder: string;
}

@Injectable()
export class SimulationDispatchedConsumerService implements OnModuleInit {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly messageBroker: IMessageBroker,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.messageBroker.subscribeToTopic<SimulationManualDispatchedPayload>(
            Topics.SIMULATION_EVENTS.exchange,
            Topics.SIMULATION_EVENTS.routingKeys.MANUAL_DISPATCHED,
            Queues.MODEL_SIMULATION_DISPATCHED,
            async (payload, ack, nack) => {
                try {
                    this.logger.log({
                        msg: 'Received simulation.manual.dispatched event',
                        entity: 'SimulationDispatchedConsumer',
                        simulationId: payload.simulationId,
                        outputFolder: payload.outputFolder,
                    });

                    await this.commandBus.execute(
                        new RegisterSimulationRunCommand({
                            simulationId: payload.simulationId,
                            outputFolder: payload.outputFolder,
                        }),
                    );

                    ack();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.logger.error({
                        msg: 'Failed to process simulation.manual.dispatched event — nacking without requeue',
                        entity: 'SimulationDispatchedConsumer',
                        simulationId: payload.simulationId,
                        error: message,
                    });
                    nack(false);
                }
            },
        );

        this.logger.log('SimulationDispatchedConsumerService initialized — listening for simulation.manual.dispatched');
    }
}
