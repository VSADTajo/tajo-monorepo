import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Logger } from 'nestjs-pino';

import { IMessageBroker } from '@domain/ports/message-broker.port';
import { AttachFewsTaskCommand, RegisterSimulationRunCommand } from '@application/commands/simulation-run.commands';
import { Queues, Topics } from '@infrastructure/messaging/messaging.registry';
import { MockModelOutputService } from '@infrastructure/services/mock-model-output.service';
import { FewsSimulationLauncherService } from '@infrastructure/services/fews-simulation-launcher.service';

/**
 * Where the model output is expected to come from.
 *   SFTP — the real flow: FEWS drops the result in the output folder.
 *   MOCK — a reference output is seeded so the pipeline can be exercised end to
 *          end without FEWS.
 *   FEWS_API — the input is posted to the FEWS PI REST service and the workflow
 *          is launched there; the run is then followed by task id instead of by
 *          watching an output folder.
 */
export type ModelSource = 'SFTP' | 'MOCK' | 'FEWS_API';

const DEFAULT_MODEL_SOURCE: ModelSource = 'SFTP';

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
        private readonly mockModelOutputService: MockModelOutputService,
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
                        }),
                    );

                    // MOCK stands in for FEWS by leaving a known-good result where the
                    // model would have left it; from there the normal poller takes over.
                    if (modelSource === 'MOCK') {
                        await this.mockModelOutputService.seedOutput(payload.outputFolder);
                    }

                    // FEWS_API pushes the input and starts the workflow right away; the
                    // task id is stored so the poller follows the run instead of a folder.
                    if (modelSource === 'FEWS_API') {
                        const taskId = await this.fewsSimulationLauncher.launch(
                            payload.simulationId,
                            payload.outputFolder,
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
