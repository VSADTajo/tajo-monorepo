import { Controller, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { TraceContext, X_TRACE_ID_HEADER } from 'tajo-toolkit';
import { v4 as uuidv4 } from 'uuid';

import { Topics } from '@infrastructure/messaging/messaging.registry';
import { ProcessTimeSeriesCommand, ITimeSeriesData } from '@application/commands/prediction.commands';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { SimulationStatus } from '@domain/entities/simulation.entity';

interface TimeSeriesIngestedPayload {
    providerConfigId?: string;
    providerName?: string;
    providerType?: string;
    seriesCount?: number;
    eventsCount?: number;
    timeSeries: ITimeSeriesData[];
}

@Controller()
export class TimeSeriesIngestedConsumer {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly simulationRepository: ISimulationRepository,
        private readonly traceContext: TraceContext,
    ) {}

    @EventPattern(Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED)
    async handleTimeSeriesIngested(
        @Payload() data: TimeSeriesIngestedPayload,
        @Ctx() context: RmqContext,
    ): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        // Extract traceId from AMQP headers or generate a new one
        const headers = originalMsg.properties?.headers || {};
        const traceId = headers[X_TRACE_ID_HEADER] || uuidv4();

        await this.traceContext.runInContext(traceId, async () => {
            try {
                this.logger.log({
                    msg: 'Timeseries ingested received',
                    entity: 'Predictions',
                    seriesCount: data.seriesCount ?? data.timeSeries?.length,
                    eventsCount: data.eventsCount ?? 0,
                });

                const timeSeries = data.timeSeries || [];
                const simulationIds = new Set<string>();

                for (const series of timeSeries) {
                    const result = await this.commandBus.execute(
                        new ProcessTimeSeriesCommand({
                            series,
                            providerConfigId: data.providerConfigId,
                            providerName: data.providerName,
                            providerType: data.providerType,
                        }),
                    );
                    simulationIds.add(result.simulationId);
                }

                // Auto-finalize simulations after all series are processed
                for (const simId of simulationIds) {
                    const simulation = await this.simulationRepository.findById(simId);
                    if (simulation && simulation.status !== SimulationStatus.FINALIZED) {
                        simulation.finalize();
                        await this.simulationRepository.update(simulation);
                        this.logger.log({ msg: 'Simulation auto-finalized', entity: 'Predictions', simulationId: simId });
                    }
                }

                channel.ack(originalMsg);
                this.logger.log({
                    msg: 'Timeseries batch processed',
                    entity: 'Predictions',
                    processedCount: timeSeries.length,
                });
            } catch (error) {
                this.logger.error({
                    msg: 'Failed to process timeseries.ingested message — rejecting without requeue to prevent infinite loop',
                    entity: 'Predictions',
                    error: String(error),
                });
                channel.nack(originalMsg, false, false);
            }
        });
    }
}
