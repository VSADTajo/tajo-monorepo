# Plan: Manual Simulation Flow — ms-predictions-api

**Spec**: ms-predictions-api/.specify/specs/manual-simulation-flow/spec.md
**Created**: 2026-06-19
**Stack**: NestJS 11 + TypeScript 5.7+ + TypeORM 0.3 + RabbitMQ + Redis

---

## Summary

Se agrega la entidad `Maneuver` (nueva) ligada a `Simulation` y se implementa un único endpoint `POST /simulations/manual` que crea la simulación con sus maniobras, consulta las predicciones de pronóstico (DataOrigin.FORECAST) de los embalses involucrados, genera el archivo de entrada y lo sube a ms-sftp-api. Tras la subida exitosa, la simulación avanza a `MODEL_PROCESSING` y se publica el evento `simulation.manual.dispatched`. El consumer existente de `timeseries.ingested` se extiende para manejar el campo opcional `simulationId`. Un nuevo consumer reacciona al evento `simulation.status.updated` (publicado por ms-model-api en caso de fallo) para transicionar la simulación a `MODEL_FAILED`.

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Language / Version | TypeScript 5.7+ / NestJS 11 |
| Primary Dependencies | `@nestjs/cqrs`, `typeorm`, `class-validator`, `nestjs-pino`, `ioredis`, `amqplib` |
| Storage | PostgreSQL 16 (`infra-db-predictions`, port 5437) + Redis 7 |
| Messaging | RabbitMQ — nuevo exchange `simulation-events`; extiende exchange `model-events` existente |
| HTTP Outbound | ms-sftp-api via `HttpService` existente (`POST /files/upload`) |
| Testing | Jest + Supertest + `@testcontainers/postgresql` |
| Target Environment | Docker Compose (local) / Hetzner prod |

---

## Architecture

El flujo se implementa como un único `CreateManualSimulationCommand` que orquesta:
1. Persistir `Simulation` (MANUAL, CREATED) + `Maneuver[]`
2. Consultar predicciones FORECAST para los reservoir codes de las maniobras
3. Construir el archivo de entrada
4. Subir a ms-sftp-api vía `ISimulationSftpService` (nuevo port)
5. Transicionar simulación a `MODEL_PROCESSING` + publicar `simulation.manual.dispatched`

Si falla la subida SFTP (paso 4), la simulación y maniobras permanecen en `CREATED` — el error se propaga al controller como `ProviderError`.

El consumer de `timeseries.ingested` ya existe (`TimeSeriesIngestedConsumer`). Se extiende mínimamente: el payload ahora puede incluir `simulationId` opcional. Si está presente, las predicciones se vinculan a esa simulación (el `ProcessTimeSeriesCommand` ya pasa el `simulationId` en el contexto de la simulación que matchea por fecha).

Un nuevo `SimulationStatusUpdatedConsumer` consume `simulation.status.updated` de ms-model-api para transicionar a `MODEL_FAILED`.

### Directory Structure

```
src/app/
├── api/
│   ├── controllers/
│   │   └── simulation.controller.ts          MODIFY — agregar POST /manual, GET /manual, GET /manual/:id
│   └── dtos/
│       └── simulation.dtos.ts                MODIFY — agregar secciones CreateManualSimulation, ListManualSimulations, GetManualSimulationById
│
├── application/
│   ├── commands/
│   │   └── manual-simulation.commands.ts     NEW — CreateManualSimulationCommand + Handler
│   ├── queries/
│   │   └── manual-simulation.queries.ts      NEW — GetManualSimulationByIdQuery, ListManualSimulationsQuery
│   ├── mappers/
│   │   └── manual-simulation.mappers.ts      NEW — CreateManualSimulationMapper, ListManualSimulationsMapper, GetManualSimulationByIdMapper
│   ├── consumers/
│   │   ├── timeseries-ingested.consumer.ts   MODIFY — aceptar simulationId opcional en payload
│   │   └── simulation-status-updated.consumer.ts  NEW — consume simulation.status.updated
│   └── application.module.ts                 MODIFY — registrar handler, queries, consumers
│
├── domain/
│   ├── entities/
│   │   └── maneuver.entity.ts                NEW — Maneuver (reservoirCode, outputFlowValue, simulationId)
│   ├── ports/
│   │   ├── maneuver-repository.port.ts       NEW — IManeuverRepository
│   │   └── simulation-sftp.port.ts           NEW — ISimulationSftpService
│   └── results/
│       └── manual-simulation.result.ts       NEW — ManualSimulationResult (Simulation + Maneuver[])
│
└── infrastructure/
    ├── persistence/
    │   └── maneuver.repository.ts            NEW — ManeuverRepository
    ├── services/
    │   └── simulation-sftp.service.ts        NEW — SimulationSftpService (llama ms-sftp-api)
    ├── messaging/
    │   └── messaging.registry.ts             MODIFY — agregar SIMULATION_EVENTS exchange + nuevas routing keys
    └── infrastructure.module.ts              MODIFY — bind IManeuverRepository + ISimulationSftpService

src/migrations/
    └── <timestamp>-add-maneuvers-table.ts    NEW
```

---

## Data Model

### Nueva tabla: `maneuvers`

```sql
CREATE TABLE "maneuvers" (
    "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
    "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
    "simulationId"     uuid NOT NULL,
    "reservoirCode"    character varying(100) NOT NULL,
    "outputFlowValue"  numeric(12,4) NOT NULL,
    CONSTRAINT "PK_maneuvers_id" PRIMARY KEY ("id"),
    CONSTRAINT "FK_maneuvers_simulation"
        FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE CASCADE
);

CREATE INDEX "IDX_maneuvers_simulationId" ON "maneuvers" ("simulationId");
```

### Entidad TypeORM: `Maneuver`

```typescript
@Entity('maneuvers')
export class Maneuver extends BaseAuditEntity implements IValidable {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column('uuid', { nullable: false })
    simulationId: string;

    @ManyToOne(() => Simulation, (s) => s.maneuvers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'simulationId' })
    simulation: Simulation;

    @Column('varchar', { length: 100, nullable: false })
    reservoirCode: string;

    @Column('numeric', { precision: 12, scale: 4, nullable: false })
    outputFlowValue: number;

    validate(): void {
        if (!this.reservoirCode?.trim()) throw new EntityError('reservoirCode is required', 'reservoirCode');
        if (this.outputFlowValue === null || this.outputFlowValue === undefined)
            throw new EntityError('outputFlowValue is required', 'outputFlowValue');
        if (this.outputFlowValue < 0)
            throw new EntityError('outputFlowValue must be non-negative', 'outputFlowValue');
    }
}
```

### Modificación en `Simulation`

Agregar relación `@OneToMany`:
```typescript
@OneToMany(() => Maneuver, (m) => m.simulation)
maneuvers: Maneuver[];
```

---

## API Contracts

### `POST /simulations/manual`

**Request:**
```json
{
  "simulationDate": "20260619120000",
  "description": "Operación de control Tranco",
  "maneuvers": [
    { "reservoirCode": "E001", "outputFlowValue": 12.5 },
    { "reservoirCode": "E002", "outputFlowValue": 0.0 }
  ]
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "simulationDate": "20260619120000",
  "status": "MODEL_PROCESSING",
  "type": "MANUAL",
  "description": "...",
  "maneuvers": [
    { "id": "uuid", "reservoirCode": "E001", "outputFlowValue": 12.5 },
    { "id": "uuid", "reservoirCode": "E002", "outputFlowValue": 0.0 }
  ],
  "createdAt": "2026-06-19T12:00:00.000Z"
}
```

**Errors:**
- `400` — zero maneuvers / negative outputFlowValue / invalid simulationDate format
- `503` — SFTP upload failed (simulation persisted in CREATED but dispatch failed)

---

### `GET /simulations/manual`

Query params: `status?: string`, `page?: number`, `limit?: number`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "simulationDate": "20260619120000",
      "status": "MODEL_PROCESSING",
      "type": "MANUAL",
      "maneuverCount": 2,
      "createdAt": "2026-06-19T12:00:00.000Z"
    }
  ],
  "total": 1, "page": 1, "limit": 20
}
```

---

### `GET /simulations/manual/:id`

**Response 200:**
```json
{
  "id": "uuid",
  "simulationDate": "20260619120000",
  "status": "FINALIZED",
  "type": "MANUAL",
  "description": "...",
  "maneuvers": [...],
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Errors:** `404` — simulación no encontrada o no es de tipo MANUAL

---

## Events

### Publica: `simulation.manual.dispatched`

```
Exchange:     simulation-events
Routing key:  simulation.manual.dispatched
Published by: CreateManualSimulationHandler (tras upload SFTP exitoso)
```

**Payload:**
```json
{
  "simulationId": "uuid",
  "outputFolder": "/simulations/<uuid>/output/"
}
```

---

### Consume: `simulation.status.updated`

```
Exchange:     simulation-events
Routing key:  simulation.status.updated
Queue:        predictions-simulation-status-updates
Published by: ms-model-api (en caso de fallo de procesamiento)
Consumer:     SimulationStatusUpdatedConsumer (nuevo)
```

**Payload:**
```json
{
  "simulationId": "uuid",
  "status": "MODEL_FAILED"
}
```

**Comportamiento:** llama a `simulation.fail()` y persiste.

---

### Extiende: `timeseries.ingested` (consumer existente)

El `TimeSeriesIngestedConsumer` existente ya suscribe a este evento. Se extiende el payload para aceptar `simulationId?: string` opcional. Si `simulationId` está presente, cada `ProcessTimeSeriesCommand` ejecutado recibe ese ID para que las predicciones queden ligadas directamente a la simulación manual sin necesidad de buscarla por fecha.

**Cambio mínimo**: añadir `simulationId?: string` al `TimeSeriesIngestedPayload` y pasarlo como parámetro al `ProcessTimeSeriesCommand`.

---

## Messaging Registry Changes

```typescript
// messaging.registry.ts — agregar:

export const Queues = {
    PREDICTIONS_TIMESERIES_PROCESSING: 'predictions-timeseries-processing',
    PREDICTIONS_SIMULATION_STATUS_UPDATES: 'predictions-simulation-status-updates',  // NEW
};

export const Topics = {
    MODEL_EVENTS: { ... },           // sin cambios
    SIMULATION_EVENTS: {             // NEW
        exchange: 'simulation-events',
        routingKeys: {
            MANUAL_DISPATCHED: 'simulation.manual.dispatched',
            STATUS_UPDATED: 'simulation.status.updated',
        },
    },
    NOTIFICATIONS: { ... },          // sin cambios
};

// TopicSubscriptions — agregar:
{
    queue: Queues.PREDICTIONS_SIMULATION_STATUS_UPDATES,
    exchange: Topics.SIMULATION_EVENTS.exchange,
    routingKey: Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED,
},
```

---

## ISimulationSftpService Port

```typescript
// src/app/domain/ports/simulation-sftp.port.ts
export abstract class ISimulationSftpService {
    abstract uploadInputFile(simulationId: string, content: Buffer): Promise<void>;
}
```

**Implementación** (`SimulationSftpService`):
- Llama `POST /files/upload` a ms-sftp-api con el archivo en multipart form
- Path destino: `/simulations/<simulationId>/input/<simulationId>.json`
- Usa `HttpService` existente con header `x-internal-caller: ms-predictions-api`
- Lanza `ProviderError` en fallo

**Variable de entorno requerida:** `SFTP_API_URL` (URL base de ms-sftp-api, ej. `http://ms-sftp-api:3003`)

---

## IManeuverRepository Port

```typescript
export abstract class IManeuverRepository {
    abstract createMany(maneuvers: Maneuver[]): Promise<Maneuver[]>;
    abstract findBySimulationId(simulationId: string): Promise<Maneuver[]>;
}
```

---

## Cache

Las queries de simulaciones manuales (`GetManualSimulationByIdQuery`, `ListManualSimulationsQuery`) se añaden al `CACHE_REGISTRY` bajo `ManeuverCacheKeys`:

```typescript
export const ManualSimulationCacheKeys = {
    byId: (id: string) => `manual-simulation:${id}`,
    list: (params: string) => `manual-simulation:list:${params}`,
    pattern: () => 'manual-simulation:*',
};
```

`CreateManualSimulationHandler` invalida `ManualSimulationCacheKeys.pattern()` tras la creación.

---

## Constitution Compliance

| Principle | Status | Notes |
|-----------|--------|-------|
| Hexagonal Architecture | ✅ | Port `ISimulationSftpService` en domain, impl en infrastructure |
| CQRS | ✅ | `CreateManualSimulationCommand`, `GetManualSimulationByIdQuery`, `ListManualSimulationsQuery` |
| Ports como abstract classes | ✅ | `IManeuverRepository`, `ISimulationSftpService` |
| Entity `validate()` | ✅ | `Maneuver.validate()` explicitamente en el handler |
| Error hierarchy | ✅ | `EntityError` → 400, `ProviderError` → 503 (SFTP), `ApiError` → status |
| Integration tests via HTTP | ✅ | e2e a través de `POST /simulations/manual`; mock de `ISimulationSftpService` y `IMessageBroker` |
| Raw SQL migrations | ✅ | `add-maneuvers-table.ts` |
| Cache invalidation | ✅ | Invalidar `manual-simulation:*` tras creación |
| Messaging ack/nack | ✅ | Consumers con `ack()` en éxito, `nack(false, false)` en fallo irrecuperable |

---

## Open Questions

| # | Pregunta | Impacto | Fecha límite |
|---|----------|---------|--------------|
| OQ-1 | ¿Cuál es el formato exacto del archivo de entrada SFTP? ¿JSON time-series igual al de salida, o diferente (CSV, XML)? Definido por el equipo externo del modelo. | Alto — afecta `SimulationSftpService.buildInputFile()` | Antes de T005 |
| OQ-2 | ¿Las predicciones FORECAST a consultar para cada `reservoirCode` se filtran por tipo de predicción específico, o se toman todas? | Medio — afecta la query al `IPredictionRepository` | Antes de T005 |
| OQ-3 | ¿`SFTP_API_URL` ya existe en el `.env` de ms-predictions-api o hay que añadirla? | Bajo | Antes de T005 |
