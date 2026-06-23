import { Controller, Inject } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { Topics } from '@infrastructure/messaging/messaging.registry';
import { SIMULATION_STATE_CACHE_PATTERNS } from '@infrastructure/cache/cache-config.registry';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';

interface SimulationStatusUpdatedPayload {
    simulationId: string;
    status: string;
}

@Controller()
export class SimulationStatusUpdatedConsumer {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly cacheService: ICacheService,
    ) {}

    @EventPattern(Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED)
    async handle(@Payload() data: SimulationStatusUpdatedPayload, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            this.logger.log({
                msg: 'Received simulation.status.updated',
                entity: 'Simulations',
                simulationId: data.simulationId,
                status: data.status,
            });

            let simulation;
            try {
                simulation = await this.simulationRepository.findById(data.simulationId);
            } catch {
                this.logger.warn({
                    msg: 'Simulation not found for status update — acking without processing',
                    entity: 'Simulations',
                    simulationId: data.simulationId,
                });
                channel.ack(originalMsg);
                return;
            }

            if (data.status === 'MODEL_FAILED') {
                simulation.fail();
                await this.simulationRepository.update(simulation);

                // Invalidate every simulation cache namespace (general + manual)
                // so GET endpoints stop serving the pre-failure status.
                for (const pattern of SIMULATION_STATE_CACHE_PATTERNS) {
                    await this.cacheService.delByPattern(pattern);
                }

                this.logger.log({
                    msg: 'Simulation marked as MODEL_FAILED',
                    entity: 'Simulations',
                    simulationId: data.simulationId,
                });
            } else {
                this.logger.warn({
                    msg: 'Unhandled simulation status update',
                    entity: 'Simulations',
                    simulationId: data.simulationId,
                    status: data.status,
                });
            }

            channel.ack(originalMsg);
        } catch (error) {
            this.logger.error({
                msg: 'Failed to process simulation.status.updated — rejecting without requeue',
                entity: 'Simulations',
                simulationId: data.simulationId,
                error: String(error),
            });
            channel.nack(originalMsg, false, false);
        }
    }
}
