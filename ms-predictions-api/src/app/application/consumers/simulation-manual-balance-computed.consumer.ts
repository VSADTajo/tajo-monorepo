import { Controller, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { TraceContext, extractTraceId } from 'tajo-toolkit';

import { Topics } from '@infrastructure/messaging/messaging.registry';
import { SIMULATION_STATE_CACHE_PATTERNS } from '@infrastructure/cache/cache-config.registry';
import { ProcessTimeSeriesCommand, ITimeSeriesData } from '@application/commands/prediction.commands';
import { ISimulationRepository } from '@domain/ports/simulation-repository.port';
import { ICacheService } from '@domain/ports/cache-service.port';
import { SimulationStatus } from '@domain/entities/simulation.entity';

// ─────────────────────────────────────────────────────────────
// Payload contract (internal to this file — no domain leakage)
// Matches the shape published by the volume-balance calculator on
// exchange `simulation-events`, routing key `simulation.manual.balance.computed`.
// ─────────────────────────────────────────────────────────────

interface BalanceEventRaw {
    date: string;
    time: string;
    value: string;
    flag: string;
}

interface BalanceTimeSeries {
    header: {
        moduleInstanceId?: string;
        locationId: string;
        parameterId: string;
        startDate: { date: string; time: string };
        endDate: { date: string; time: string };
        forecastDate: { date: string; time: string };
        missVal?: string;
        stationName?: string;
        units?: string;
        // other metadata fields (timeStep, creationDate, …) — ignored
        [key: string]: unknown;
    };
    events: BalanceEventRaw[];
}

interface SimulationBalanceComputedEvent {
    simulationId?: string;
    providerName?: string; // expected: 'volume-calculator'
    seriesCount?: number;
    eventsCount?: number;
    computedAt?: string; // ISO-8601
    timeSeries?: BalanceTimeSeries[];
}

// ─────────────────────────────────────────────────────────────
// Adapter: BalanceTimeSeries → ITimeSeriesData
// ─────────────────────────────────────────────────────────────

function toTimeSeriesData(series: BalanceTimeSeries, missVal: string | undefined): ITimeSeriesData {
    const missing = missVal ?? '-999.0';
    return {
        locationId: series.header.locationId,
        parameterId: series.header.parameterId,
        moduleInstanceId: series.header.moduleInstanceId ?? 'volume_calculator',
        stationName: series.header.stationName,
        units: series.header.units,
        forecastDate: `${series.header.forecastDate.date}T${series.header.forecastDate.time}Z`,
        startDate: `${series.header.startDate.date}T${series.header.startDate.time}Z`,
        endDate: `${series.header.endDate.date}T${series.header.endDate.time}Z`,
        events: (series.events ?? []).map((e) => {
            const isMissing = e.value === missing;
            return {
                timestamp: `${e.date}T${e.time}Z`,
                value: isMissing ? 0 : Number(e.value),
                flag: Number(e.flag ?? '0') || 0,
                isMissing,
            };
        }),
    };
}

// ─────────────────────────────────────────────────────────────
// Consumer
// ─────────────────────────────────────────────────────────────

@Controller()
export class SimulationManualBalanceComputedConsumer {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly commandBus: CommandBus,
        private readonly simulationRepository: ISimulationRepository,
        private readonly cacheService: ICacheService,
        private readonly traceContext: TraceContext,
    ) {}

    @EventPattern(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_BALANCE_COMPUTED)
    async handle(@Payload() data: SimulationBalanceComputedEvent, @Ctx() context: RmqContext): Promise<void> {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        const traceId = extractTraceId(originalMsg.properties?.headers);

        await this.traceContext.runInContext(traceId, async () => {
            try {
                if (!data?.simulationId) {
                    this.logger.error({
                        msg: 'simulation.manual.balance.computed missing simulationId — rejecting',
                        entity: 'Predictions',
                        payloadKeys: Object.keys(data ?? {}),
                    });
                    channel.nack(originalMsg, false, false);
                    return;
                }

                const timeSeries = data.timeSeries ?? [];
                this.logger.log({
                    msg: 'Received simulation.manual.balance.computed',
                    entity: 'Predictions',
                    simulationId: data.simulationId,
                    seriesCount: data.seriesCount ?? timeSeries.length,
                    eventsCount: data.eventsCount ?? 0,
                });

                if (timeSeries.length === 0) {
                    this.logger.warn({
                        msg: 'simulation.manual.balance.computed with empty timeSeries — acking, no-op',
                        entity: 'Predictions',
                        simulationId: data.simulationId,
                    });
                    channel.ack(originalMsg);
                    return;
                }

                for (const series of timeSeries) {
                    const adapted: ITimeSeriesData = toTimeSeriesData(
                        series,
                        series.header?.missVal as string | undefined,
                    );
                    await this.commandBus.execute(
                        new ProcessTimeSeriesCommand({
                            series: adapted,
                            providerName: data.providerName ?? 'volume-calculator',
                            simulationId: data.simulationId,
                        }),
                    );
                }

                // Auto-finalize the referenced simulation (one simulation per event)
                const simulation = await this.simulationRepository.findById(data.simulationId);
                let statusChanged = false;
                if (simulation && simulation.status !== SimulationStatus.FINALIZED) {
                    simulation.finalize();
                    await this.simulationRepository.update(simulation);
                    statusChanged = true;
                    this.logger.log({
                        msg: 'Simulation auto-finalized after balance computed',
                        entity: 'Simulations',
                        simulationId: data.simulationId,
                    });
                }

                // Invalidate every simulation cache namespace so GET endpoints reflect the new status
                if (statusChanged) {
                    for (const pattern of SIMULATION_STATE_CACHE_PATTERNS) {
                        await this.cacheService.delByPattern(pattern);
                    }
                }

                channel.ack(originalMsg);
            } catch (error) {
                this.logger.error({
                    msg: 'Failed to process simulation.manual.balance.computed — rejecting without requeue',
                    entity: 'Predictions',
                    simulationId: data?.simulationId,
                    error: String(error),
                });
                channel.nack(originalMsg, false, false);
            }
        });
    }
}
