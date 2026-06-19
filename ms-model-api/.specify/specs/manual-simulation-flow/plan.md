# Plan: Manual Simulation Flow — ms-model-api

**Spec**: ms-model-api/.specify/specs/manual-simulation-flow/spec.md
**Created**: 2026-06-19
**Stack**: NestJS 11 + TypeScript 5.7+ + TypeORM 0.3 + RabbitMQ (raw amqplib)

---

## Summary

Se agrega una nueva entidad `SimulationRun` que trackea el ciclo de vida de cada simulación manual. Un consumer `SimulationDispatchedConsumerService` (amqplib raw, `OnModuleInit`) suscribe al exchange `simulation-events` y crea un `SimulationRun` en `WAITING_RESULT` por cada evento `simulation.manual.dispatched`. Un job periódico `SimulationRunPollerService` consulta los registros pendientes, descarga y parsea el archivo de resultado del SFTP usando el mismo patrón que `SftpFileProviderService`, y publica `timeseries.ingested` con `simulationId`. El flujo automático existente (`ProviderConfig` / `IngestionRun` / `ProviderSchedulerService`) no se modifica.

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Language / Version | TypeScript 5.7+ / NestJS 11 |
| Primary Dependencies | `@nestjs/cqrs`, `typeorm`, `amqplib`, `axios`, `nestjs-pino`, `@nestjs/schedule` |
| Storage | PostgreSQL 16 (`infra-db-model`, port 5439) + Redis 7 |
| Messaging | RabbitMQ raw amqplib — suscribe a `simulation-events`, publica a `model-events` y `simulation-events` |
| HTTP Outbound | ms-sftp-api vía axios (`GET /files`, `GET /files/download`, `POST /files/move`) |
| Testing | Jest + Supertest + `@testcontainers/postgresql` |
| Target Environment | Docker Compose (local) / Hetzner prod |

---

## Architecture

### Decisión de consumer: raw amqplib, NO @nestjs/microservices

ms-model-api ya usa amqplib directamente en `RabbitmqService` sin `@nestjs/microservices`. Se extiende ese patrón:
- `IMessageBroker` recibe un método `subscribeToTopic(exchange, routingKey, queue, handler)` abstracto
- `RabbitmqService` implementa el subscribe usando `channel.consume`
- `SimulationDispatchedConsumerService` implementa `OnModuleInit` y llama `subscribeToTopic` en `onModuleInit`

### Separación de responsabilidades

| Componente | Responsabilidad |
|------------|----------------|
| `SimulationDispatchedConsumerService` | Consume `simulation.manual.dispatched` → crea `SimulationRun` |
| `SimulationRunPollerService` | Cron job → polla output folders → orquesta procesamiento |
| `SimulationResultFetcherService` | Llama ms-sftp-api (list/download/move) + parsea JSON time-series |
| `SimulationRun` entity | Persiste estado de cada simulación manual en curso |

### Directory Structure

```
src/app/
├── api/                                    sin cambios
│
├── application/
│   ├── commands/
│   │   └── simulation-run.commands.ts      NEW — RegisterSimulationRunCommand + Handler
│   └── application.module.ts              MODIFY — registrar RegisterSimulationRunHandler
│
├── domain/
│   ├── entities/
│   │   └── simulation-run.entity.ts       NEW — SimulationRun (simulationId, outputFolder, status)
│   ├── types/
│   │   └── simulation-run-status.enum.ts  NEW — WAITING_RESULT | COMPLETED | FAILED
│   ├── ports/
│   │   ├── message-broker.port.ts         MODIFY — agregar subscribeToTopic()
│   │   └── simulation-run-repository.port.ts  NEW — ISimulationRunRepository
│   └── results/
│       └── simulation-run.result.ts       NEW — SimulationRunResult
│
└── infrastructure/
    ├── persistence/
    │   └── simulation-run.repository.ts   NEW — SimulationRunRepository
    ├── messaging/
    │   ├── messaging.registry.ts          MODIFY — SIMULATION_EVENTS (consume) + TopicSubscriptions
    │   └── rabbitmq.service.ts            MODIFY — implementar subscribeToTopic()
    ├── services/
    │   ├── simulation-result-fetcher.service.ts  NEW — lista/descarga/parsea/mueve via ms-sftp-api
    │   ├── simulation-dispatched-consumer.service.ts  NEW — OnModuleInit, subscribe RMQ
    │   └── simulation-run-poller.service.ts       NEW — @Cron, polla WAITING_RESULT runs
    └── infrastructure.module.ts           MODIFY — registrar nuevas entidades, repos, servicios

src/migrations/
    └── <timestamp>-add-simulation-runs-table.ts  NEW
```

---

## Data Model

### Nueva tabla: `simulation_runs`

```sql
CREATE TABLE "simulation_runs" (
    "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
    "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
    "simulationId"   uuid NOT NULL,
    "outputFolder"   character varying(500) NOT NULL,
    "status"         character varying(20) NOT NULL DEFAULT 'WAITING_RESULT',
    "startedAt"      TIMESTAMP NOT NULL DEFAULT now(),
    "completedAt"    TIMESTAMP NULL,
    "errorMessage"   text NULL,
    CONSTRAINT "PK_simulation_runs_id" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_simulation_runs_simulationId" UNIQUE ("simulationId")
);

CREATE INDEX "IDX_simulation_runs_status" ON "simulation_runs" ("status");
```

### Entidad TypeORM

```typescript
@Entity('simulation_runs')
export class SimulationRun extends BaseAuditEntity implements IValidable {
    @PrimaryGeneratedColumn('uuid') id: string;
    @Column('uuid', { nullable: false, unique: true }) simulationId: string;
    @Column('varchar', { length: 500, nullable: false }) outputFolder: string;
    @Column('varchar', { length: 20, nullable: false, default: 'WAITING_RESULT' }) status: SimulationRunStatus;
    @Column('timestamp', { nullable: false }) startedAt: Date;
    @Column('timestamp', { nullable: true }) completedAt: Date | null;
    @Column('text', { nullable: true }) errorMessage: string | null;

    complete(): void { this.status = SimulationRunStatus.COMPLETED; this.completedAt = new Date(); }
    fail(error: string): void { this.status = SimulationRunStatus.FAILED; this.completedAt = new Date(); this.errorMessage = error; }
}
```

---

## API Contracts

No se agregan endpoints HTTP en esta feature. Toda la interacción es vía RabbitMQ.

---

## Events

### Consume: `simulation.manual.dispatched`

```
Exchange:     simulation-events
Routing key:  simulation.manual.dispatched
Queue:        model-simulation-dispatched
Consumer:     SimulationDispatchedConsumerService.onModuleInit()
```

**Payload recibido:**
```json
{ "simulationId": "uuid", "outputFolder": "/simulations/<uuid>/output/" }
```

**Comportamiento:** ejecuta `RegisterSimulationRunCommand`. Si ya existe un `SimulationRun` con ese `simulationId` → ack sin crear (idempotente).

---

### Publica: `timeseries.ingested` (enriquecido)

```
Exchange:     model-events        (ya existe)
Routing key:  timeseries.ingested (ya existe)
```

**Payload nuevo (agrega simulationId al existente):**
```json
{
  "simulationId": "uuid",
  "providerName": "manual-simulation",
  "seriesCount": 3,
  "eventsCount": 144,
  "timeSeries": [...]
}
```

El campo `simulationId` es opcional — los consumers existentes que no lo esperan lo ignoran.

---

### Publica: `simulation.status.updated`

```
Exchange:     simulation-events
Routing key:  simulation.status.updated
Published by: SimulationRunPollerService (en caso de fallo de parseo)
```

**Payload:**
```json
{ "simulationId": "uuid", "status": "MODEL_FAILED" }
```

---

## IMessageBroker Port Extension

```typescript
// domain/ports/message-broker.port.ts — agregar:
export type MessageHandler<T = unknown> = (
    payload: T,
    ack: () => void,
    nack: (requeue: boolean) => void,
) => Promise<void>;

export abstract class IMessageBroker {
    abstract publish<T>(queue: string, message: T): Promise<void>;
    abstract publishToTopic<T>(exchange: string, routingKey: string, message: T): Promise<void>;
    abstract subscribeToTopic<T>(
        exchange: string,
        routingKey: string,
        queue: string,
        handler: MessageHandler<T>,
    ): Promise<void>;
}
```

---

## SimulationResultFetcherService

Reutiliza el mismo patrón de `SftpFileProviderService` pero sin `ProviderConfig` — recibe el directorio directamente:

```typescript
interface FetchResult {
    timeSeries: NormalizedTimeSeriesResult[];
    processedFileName: string;
}

class SimulationResultFetcherService {
    async fetchFromFolder(outputFolder: string): Promise<FetchResult | null>
    // → GET /files?directory=outputFolder
    // → si 0 archivos JSON: return null
    // → download primer archivo
    // → parsear con mapResponseToNormalized (mismo algoritmo que SftpFileProviderService)
    // → POST /files/move a outputFolder/historial/<filename>
    // → return { timeSeries, processedFileName }
    // → si parse falla: POST /files/move a outputFolder/corrupted/<filename>, throw ProviderError
}
```

---

## SimulationRunPollerService

```typescript
@Injectable()
class SimulationRunPollerService implements OnModuleInit {
    // Intervalo configurable: SIMULATION_POLL_INTERVAL_MINUTES (default 5)
    // Registra un setInterval en onModuleInit (mismo patrón que ProviderSchedulerService)

    async pollOnce(): Promise<void> {
        const pendingRuns = await simulationRunRepository.findWaitingResult();
        for (const run of pendingRuns) {
            await this.processSingleRun(run);
        }
    }

    private async processSingleRun(run: SimulationRun): Promise<void> {
        try {
            const result = await fetcher.fetchFromFolder(run.outputFolder);
            if (!result) return; // archivo aún no disponible

            await messageBroker.publishToTopic(MODEL_EVENTS, TIMESERIES_INGESTED, {
                simulationId: run.simulationId,
                providerName: 'manual-simulation',
                seriesCount: result.timeSeries.length,
                eventsCount: result.timeSeries.reduce(...),
                timeSeries: result.timeSeries,
            });

            run.complete();
            await simulationRunRepository.update(run);
        } catch (error) {
            run.fail(error.message);
            await simulationRunRepository.update(run);
            await messageBroker.publishToTopic(SIMULATION_EVENTS, STATUS_UPDATED, {
                simulationId: run.simulationId,
                status: 'MODEL_FAILED',
            });
        }
    }
}
```

---

## Constitution Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| Hexagonal Architecture | ✅ | `ISimulationRunRepository` port en domain; impl en infrastructure |
| CQRS | ✅ | `RegisterSimulationRunCommand` + handler para la escritura |
| Ports como abstract classes | ✅ | `ISimulationRunRepository`, extensión de `IMessageBroker` |
| Entity `validate()` | ✅ | `SimulationRun.validate()` en handler |
| Error hierarchy | ✅ | `ProviderError` en fetcher/consumer, `RepositoryError` en repo |
| Raw SQL migrations | ✅ | `add-simulation-runs-table.ts` |
| Existing flows no modificados | ✅ | `ProviderConfig`/`IngestionRun`/`ProviderSchedulerService` intactos |
| Integration tests via HTTP | ✅ | Tests unitarios para consumer y poller; e2e para el comando via repo real |

---

## Open Questions

| # | Pregunta | Impacto | Fecha límite |
|---|----------|---------|--------------|
| OQ-1 | `SIMULATION_POLL_INTERVAL_MINUTES` — ¿valor por defecto razonable? El plan asume 5 min. | Bajo | Antes de T016 |
