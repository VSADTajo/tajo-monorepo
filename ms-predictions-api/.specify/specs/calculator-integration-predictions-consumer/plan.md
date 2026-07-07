# Implementation Plan: Calculator Integration — Predictions Consumer

**Branch**: `calculator-integration-predictions-consumer` | **Date**: 2026-07-05
**Spec**: `.specify/specs/calculator-integration-predictions-consumer/spec.md`
**Service**: `ms-predictions-api`
**Type**: additive (new consumer + new queue), no schema changes, no domain changes

---

## Summary

Add a **new** AMQP consumer to ms-predictions-api that subscribes to the topic exchange `simulation-events` on routing key `simulation.manual.balance.computed`, backed by a new durable queue `predictions-simulation-manual-balance`. The consumer adapts the incoming `SimulationBalanceComputedEvent` payload into a series of `ProcessTimeSeriesCommand`s (one per `timeSeries[]` entry), reuses the existing `ProcessTimeSeriesHandler` verbatim, auto-finalizes the referenced `Simulation`, and invalidates the simulation caches. The legacy `TimeSeriesIngestedConsumer` is untouched.

## Technical Context

- **Language/Version**: TypeScript 5.7+ (strict) on Node.js >= 22
- **Framework**: NestJS 11 + @nestjs/cqrs 11 + @nestjs/microservices (RMQ)
- **Storage**: PostgreSQL 16 via TypeORM (no schema change)
- **Cache**: Redis 7 via ioredis (uses existing `SIMULATION_STATE_CACHE_PATTERNS`)
- **Messaging**: RabbitMQ 3.13 via amqplib
- **Testing**: Jest + Testcontainers PostgreSQL
- **Path aliases**: `@application/*`, `@domain/*`, `@infrastructure/*`, `@app/*` (mandatory in `src/`)

## Constitution Check

Aligned with root constitution (`.specify/memory/constitution.md`) and the service's local constitution:

- ✅ Hexagonal + CQRS: consumer sits in `application/consumers/`, orchestrates only via the existing `CommandBus`; no direct repository access from the consumer for prediction writes; only reads/writes the `Simulation` aggregate via `ISimulationRepository` (same pattern as `TimeSeriesIngestedConsumer`).
- ✅ Ports remain abstract classes as DI tokens. No new port introduced.
- ✅ No `synchronize: true`. No schema change means no migration file needed.
- ✅ Structured logging via `nestjs-pino` `Logger` — no `console.log`.
- ✅ Error handling via ack/nack + structured error log — the consumer never throws to Nest microservice runtime (would poison-loop under `noAck: false`).
- ✅ Testing via HTTP endpoints for state assertions; consumer invoked directly with a synthetic RmqContext (matches the pattern in the existing consumer's spec).
- ✅ Reuses existing `ProcessTimeSeriesCommand` — no new command, no new mapper, no new DTO.

## Project Structure

```text
ms-predictions-api/
├── src/
│   ├── main.ts                                              # MODIFIED: add 3rd connectMicroservice() for the new queue
│   └── app/
│       ├── application/
│       │   ├── application.module.ts                        # MODIFIED: register SimulationManualBalanceComputedConsumer in controllers[]
│       │   └── consumers/
│       │       ├── timeseries-ingested.consumer.ts          # UNTOUCHED (regression contract)
│       │       ├── timeseries-ingested.consumer.spec.ts     # UNTOUCHED (regression contract)
│       │       ├── simulation-status-updated.consumer.ts    # UNTOUCHED
│       │       ├── simulation-manual-balance-computed.consumer.ts        # NEW
│       │       └── simulation-manual-balance-computed.consumer.spec.ts   # NEW (unit)
│       └── infrastructure/
│           └── messaging/
│               └── messaging.registry.ts                    # MODIFIED: +1 queue const, +1 routing key, +1 topic subscription
└── test/
    ├── factories/
    │   └── simulation-manual-balance-computed.factory.ts    # NEW: buildBalanceComputedPayload(overrides?)
    └── modules/
        └── manual-simulation/
            └── consume-balance-computed.e2e-spec.ts         # NEW: e2e via Testcontainers
```

No files are deleted. No files outside `ms-predictions-api/` are touched.

---

## Design

### 1. Messaging registry additions

`src/app/infrastructure/messaging/messaging.registry.ts` — append (does NOT remove or rename anything):

```typescript
export const Queues = {
    PREDICTIONS_TIMESERIES_PROCESSING: 'predictions-timeseries-processing',
    PREDICTIONS_SIMULATION_STATUS_UPDATES: 'predictions-simulation-status-updates',
    PREDICTIONS_SIMULATION_MANUAL_BALANCE: 'predictions-simulation-manual-balance', // NEW
};

export const Topics = {
    MODEL_EVENTS: { /* unchanged */ },
    SIMULATION_EVENTS: {
        exchange: 'simulation-events',
        routingKeys: {
            MANUAL_DISPATCHED: 'simulation.manual.dispatched',
            MANUAL_BALANCE_COMPUTED: 'simulation.manual.balance.computed', // NEW
            STATUS_UPDATED: 'simulation.status.updated',
        },
    },
    NOTIFICATIONS: { /* unchanged */ },
};

export const TopicSubscriptions: TopicSubscription[] = [
    { queue: Queues.PREDICTIONS_TIMESERIES_PROCESSING,       exchange: Topics.MODEL_EVENTS.exchange,      routingKey: Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED },
    { queue: Queues.PREDICTIONS_SIMULATION_STATUS_UPDATES,   exchange: Topics.SIMULATION_EVENTS.exchange, routingKey: Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED },
    { queue: Queues.PREDICTIONS_SIMULATION_MANUAL_BALANCE,   exchange: Topics.SIMULATION_EVENTS.exchange, routingKey: Topics.SIMULATION_EVENTS.routingKeys.MANUAL_BALANCE_COMPUTED }, // NEW
];
```

### 2. Bootstrap (`src/main.ts`)

Add a third `connectMicroservice` block mirroring the two existing ones, so RabbitMQ creates the durable queue and binds it via the existing `RabbitmqService` startup (which reads `TopicSubscriptions`). The block MUST live inside the same `if (rabbitmqConfig.enabled)` guard:

```typescript
app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
        urls: [rabbitmqConfig.url],
        queue: Queues.PREDICTIONS_SIMULATION_MANUAL_BALANCE,
        queueOptions: { durable: true, arguments: { 'x-dead-letter-exchange': '' } },
        prefetchCount: rabbitmqConfig.prefetch,
        noAck: false,
    },
});
```

Update the "consumers listening on" log line to list all three queues.

### 3. Payload contract & type

Introduce a payload interface **inside the new consumer file** (no domain leakage):

```typescript
interface SimulationBalanceComputedEvent {
    simulationId?: string;
    providerName?: string;               // expected: 'volume-calculator'
    seriesCount?: number;
    eventsCount?: number;
    computedAt?: string;                 // ISO-8601
    timeSeries?: BalanceTimeSeries[];    // possibly undefined/empty
}

interface BalanceTimeSeries {
    header: {
        moduleInstanceId?: string;
        locationId: string;
        parameterId: string;             // e.g. 'v.balance.q.in.for.eps.75'
        startDate: { date: string; time: string };
        endDate:   { date: string; time: string };
        forecastDate: { date: string; time: string };
        missVal?: string;                // e.g. '-999.0'
        stationName?: string;
        units?: string;                  // e.g. 'hm3'
        // other header fields (timeStep, creationDate, ...) — metadata only, ignored
    };
    events: Array<{ date: string; time: string; value: string; flag: string }>;
}
```

### 4. Payload → `ITimeSeriesData` adapter

`ProcessTimeSeriesCommand` expects the `ITimeSeriesData` shape defined in `src/app/application/commands/prediction.commands.ts:32-43`:

```typescript
interface ITimeSeriesData {
    locationId: string;
    parameterId: string;
    moduleInstanceId: string;
    stationName?: string;
    units?: string;
    forecastDate: string;      // ISO
    startDate?: string;         // ISO
    endDate?: string;           // ISO
    events: Array<{ timestamp: string; value: number; flag?: number; isMissing?: boolean }>;
}
```

The consumer maps each incoming `BalanceTimeSeries` to `ITimeSeriesData` inline (no separate mapper class — trivial transform, kept next to the consumer for locality):

```typescript
function toTimeSeriesData(series: BalanceTimeSeries, missVal: string | undefined): ITimeSeriesData {
    const missing = missVal ?? '-999.0';
    return {
        locationId: series.header.locationId,
        parameterId: series.header.parameterId,
        moduleInstanceId: series.header.moduleInstanceId ?? 'volume_calculator',
        stationName: series.header.stationName,
        units: series.header.units,
        forecastDate: `${series.header.forecastDate.date}T${series.header.forecastDate.time}Z`,
        startDate:    `${series.header.startDate.date}T${series.header.startDate.time}Z`,
        endDate:      `${series.header.endDate.date}T${series.header.endDate.time}Z`,
        events: (series.events ?? []).map((e) => {
            const isMissing = e.value === missing;
            return {
                timestamp: `${e.date}T${e.time}Z`,
                value: isMissing ? 0 : Number(e.value),
                flag: Number(e.flag ?? '0'),
                isMissing,
            };
        }),
    };
}
```

Notes on `parameterId` handling *(no change to the existing handler is required)*:

- `ProcessTimeSeriesHandler` derives `typeName` and `percentile` via:
  - `percentileMatch = parameterId.match(/\.(\d+)$/)` → for `v.balance.q.in.for.eps.75` → `percentile=75`, `typeName='v.balance.q.in.for.eps'`.
  - For `v.balance.q.in.for.harmonie` no digit suffix → `percentile=null`, `typeName='v.balance.q.in.for.harmonie'`.
- `findOrCreateByName(typeName, units='hm3')` will lazily create the `PredictionType` on first sight. `varchar(100)` accommodates all balance names (~28 chars max).
- **No modification** to the handler is planned or approved.

### 5. New consumer

`src/app/application/consumers/simulation-manual-balance-computed.consumer.ts` — full sketch:

```typescript
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
                    const adapted: ITimeSeriesData = toTimeSeriesData(series, series.header?.missVal);
                    await this.commandBus.execute(
                        new ProcessTimeSeriesCommand({
                            series: adapted,
                            providerName: data.providerName ?? 'volume-calculator',
                            simulationId: data.simulationId,
                        }),
                    );
                }

                // Auto-finalize the target simulation (single simulation per event, unlike the legacy consumer)
                let statusChanged = false;
                const simulation = await this.simulationRepository.findById(data.simulationId);
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
```

Design notes:

- `@EventPattern(Topics.SIMULATION_EVENTS.routingKeys.MANUAL_BALANCE_COMPUTED)` — topic exchange with `simulation.manual.balance.computed` routing key. NestJS microservices dispatches by pattern; the queue binding is created at bootstrap by the RabbitMQ transport + the entry in `TopicSubscriptions`.
- **Simulation lookup on missing/unknown id**: `simulationRepository.findById(id)` throws `RepositoryError` when the row doesn't exist. The outer `try/catch` transforms that into an error log + nack (requeue=false) — same behavior contract as `TimeSeriesIngestedConsumer`. This satisfies US3 acceptance scenario 1 without a duplicate lookup.
- **Auto-finalize semantics differ slightly from the legacy consumer**: the legacy one collects a Set of `simulationId`s across the batch. Here, every event pertains to exactly one simulation (the calculator's contract), so we finalize that one directly. Simpler and safer.
- **Idempotency** is inherited from `ProcessTimeSeriesHandler.findByUniqueConstraint(...)`, so a redelivered message won't create duplicate predictions. The second `finalize()` call on an already-`FINALIZED` simulation is guarded by the `if (simulation.status !== FINALIZED)` check.
- **Trace propagation** matches the pattern used by `TimeSeriesIngestedConsumer`.

### 6. Application module wiring

`src/app/application/application.module.ts` — additive change:

- `import { SimulationManualBalanceComputedConsumer } from '@application/consumers/simulation-manual-balance-computed.consumer';`
- Append it to `controllers: [...]` next to `TimeSeriesIngestedConsumer` and `SimulationStatusUpdatedConsumer`.
- No provider registration is needed (it depends only on already-provided beans: `CommandBus`, `Logger`, `ISimulationRepository`, `ICacheService`, `TraceContext`).

### 7. Cache

- Reuses `SIMULATION_STATE_CACHE_PATTERNS` (already exported from `@infrastructure/cache/cache-config.registry` and used by both legacy consumers). No new cache key.
- Individual prediction caches (`PredictionCacheKeys`, `SimulationCacheKeys`) are invalidated by `ProcessTimeSeriesHandler` on every insert — the consumer does not need to duplicate that.

### 8. Migration

None. No schema, no data change. `synchronize=false` remains.

---

## Test Plan

### Unit test — `simulation-manual-balance-computed.consumer.spec.ts`

Following the pattern in `timeseries-ingested.consumer.spec.ts`:

- Mocks: `CommandBus`, `ISimulationRepository`, `ICacheService`, `TraceContext`, `Logger`.
- Cases:
  1. **Happy path**: `simulationId` known, 3 series, sim status `MODEL_PROCESSING`. Assert `commandBus.execute` called 3× with `ProcessTimeSeriesCommand` whose `.simulationId` matches, sim finalized, `delByPattern` called for both `simulations:*` and `manual-simulation:*`, `ack` called once.
  2. **Simulation already FINALIZED**: no `update`, no `delByPattern`, ack called.
  3. **Missing `simulationId`**: nack (requeue=false), commandBus not invoked, ack not called.
  4. **Empty `timeSeries`**: ack, warning log, commandBus not invoked, no finalize.
  5. **`simulationRepository.findById` throws** (unknown id): nack (requeue=false), error log with the offending id.
  6. **`commandBus.execute` throws** mid-batch: nack (requeue=false), error log, no partial finalize.
  7. **`missVal` mapping**: an event with `value === '-999.0'` produces an `ITimeSeriesData.event` with `isMissing=true, value=0`; a numeric event maps to `value=Number(...)`, `isMissing=false`.
  8. **traceId propagation**: `traceContext.runInContext` is invoked with the incoming header traceId.

### E2E — `test/modules/manual-simulation/consume-balance-computed.e2e-spec.ts`

Following the Testcontainers pattern established by other e2e specs in this service:

- **Setup**: `createTestApp({ entities: [Simulation, Maneuver, PredictionType, Prediction, PredictionResult], controllers: [SimulationController, PredictionController, SimulationManualBalanceComputedConsumer], providers: [ProcessTimeSeriesHandler, ...query handlers required by GET endpoints, ISimulationRepository→SimulationRepository, IPredictionTypeRepository→PredictionTypeRepository, IPredictionRepository→PredictionRepository, IPredictionResultRepository→PredictionResultRepository, IStationThresholdService→mock (returns null), ICacheService→no-op, IMessageBroker→no-op, TraceContext→real-or-noop] })`.
- **Seed via HTTP**: `POST /simulations/manual` to create a manual simulation in `CREATED`, then transition it programmatically to `MODEL_PROCESSING` by calling the repository directly *(same acceptable shortcut used in `create-manual-simulation.e2e-spec.ts`)* — this is state setup, not the assertion target.
- **Invoke the consumer**: `consumer.handle(payload, mockRmqContext)` where `mockRmqContext` returns an in-memory `{ ack, nack }` channel — same technique as the existing consumer spec.
- **Assert via HTTP**:
  1. Happy path (6 series) → `GET /simulations/manual/:id` returns `status='FINALIZED'` and `predictions.length === 6`.
  2. Unknown simulationId → nack called, no rows created, no crash.
  3. Empty series → ack called, sim status unchanged (`MODEL_PROCESSING`).
  4. Duplicate delivery (invoke twice) → same 6 predictions, no duplicates, no double-finalize error.
  5. Legacy non-regression: instantiate `TimeSeriesIngestedConsumer` in the same test app, feed a canonical `timeseries.ingested` payload, assert it still ends in ack and produces predictions on a different simulation. *(This test lives in a separate `it(...)` block to keep concerns isolated but shares the same `beforeAll` module.)*

### Non-regression contract

- `timeseries-ingested.consumer.spec.ts` — unchanged, must pass.
- `simulation-status-updated.consumer.spec.ts` — unchanged, must pass.
- All e2e specs under `test/modules/predictions/` and `test/modules/manual-simulation/` — unchanged, must pass.

---

## Failure modes & runbook hooks

- **Poison message in the new queue** (unparseable JSON, missing simulationId, unknown simulationId): nack + requeue=false → message is dropped. Structured error log `Failed to process simulation.manual.balance.computed`. teammate `observability-runbook` documents the Coralogix query.
- **Consumer registered but binding missing**: bootstrap logs the queue name; RabbitMQ management UI at :15672 shows the queue under exchange `simulation-events`. If not, revert model-hook flag and investigate `TopicSubscriptions` diff.
- **Simulation stuck in `MODEL_PROCESSING`**: means the calculator never published OR the new consumer nacked. Check RabbitMQ `predictions-simulation-manual-balance` queue depth vs. `simulation-events` deadlettered messages, then the service logs for the `simulationId`.

---

## Rollout & rollback

- **Deploy**: normal Jenkins pipeline for ms-predictions-api. Because the new queue binding is created at bootstrap, deployment can precede the calculator's first publish safely (queue exists, no consumer starvation).
- **Dark launch**: while ms-model-api flag is OFF, the new queue receives nothing. Zero-risk deploy.
- **Rollback**: revert this commit → new consumer + new queue disappear at next boot. The queue itself remains in RabbitMQ (durable) but nothing consumes it — messages accumulate; drain via `rabbitmqctl purge_queue`.

---

## Open questions (default decisions made)

1. **DLQ configuration**: `queueOptions.arguments['x-dead-letter-exchange']` is set to `''` matching the two existing queues (same as legacy). Real DLQ configuration is deferred to the infra teammate — not in this feature.
2. **`traceContext` provider registration**: reuse the existing binding from the module tree (already available since the legacy consumer uses it). No new provider.
3. **`stationName` when missing**: passed through as `undefined`; the existing handler maps `undefined → null` on the entity. No special handling.
4. **`flag` field on events**: the calculator emits it as a string; we coerce with `Number(e.flag ?? '0')`. If NaN slips through the existing entity accepts `flag: number` — we default to 0 defensively.
