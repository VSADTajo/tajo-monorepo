import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IMessageBroker } from '@domain/ports/message-broker.port';
import { AttachFewsTaskCommand, RegisterSimulationRunCommand } from '@application/commands/simulation-run.commands';
import { Queues, Topics } from '@infrastructure/messaging/messaging.registry';
import { FewsSimulationLauncherService } from '@infrastructure/services/fews-simulation-launcher.service';
import { DEFAULT_MODEL_SOURCE, isDirectSource, ModelSource } from '@domain/types/model-source.type';

interface SimulationManualDispatchedPayload {
    simulationId: string;
    outputFolder: string;
    /** Absent on events published before this field existed — defaults to SFTP. */
    modelSource?: ModelSource;
}

@Injectable()
export class SimulationDispatchedConsumerService implements OnModuleInit {
    constructor(
        @Inject(Logger)
        private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly messageBroker: IMessageBroker,
        private readonly fewsSimulationLauncher: FewsSimulationLauncherService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.messageBroker.subscribeToTopic<SimulationManualDispatchedPayload>(
            Topics.SIMULATION_EVENTS.exchange,
            Topics.SIMULATION_EVENTS.routingKeys.MANUAL_DISPATCHED,
            Queues.MODEL_SIMULATION_DISPATCHED,
            async (payload, ack, nack) => {
                try {
                    const modelSource = payload.modelSource ?? DEFAULT_MODEL_SOURCE;

                    this.logger.log({
                        msg: 'Received simulation.manual.dispatched event',
                        entity: 'SimulationDispatchedConsumer',
                        simulationId: payload.simulationId,
                        outputFolder: payload.outputFolder,
                        modelSource,
                    });

                    await this.commandBus.execute(
                        new RegisterSimulationRunCommand({
                            simulationId: payload.simulationId,
                            outputFolder: payload.outputFolder,
                            modelSource,
                        }),
                    );

                    // FEWS_API and MOCK both push the input and start the workflow
                    // through the PI REST service — the only difference between them
                    // is which service that is. The task id is stored so the poller
                    // follows the run instead of watching an output folder.
                    if (isDirectSource(modelSource)) {
                        const taskId = await this.fewsSimulationLauncher.launch(
                            payload.simulationId,
                            payload.outputFolder,
                            modelSource,
                        );
                        await this.commandBus.execute(
                            new AttachFewsTaskCommand({ simulationId: payload.simulationId, fewsTaskId: taskId }),
                        );
                    }

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
