# Plan — Simulation Results Endpoint (ms-predictions-api)

**Feature**: `simulation-results-endpoint`
**Spec**: `.specify/specs/simulation-results-endpoint/spec.md`
**Target service**: `ms-predictions-api`
**Constitution**: root `.specify/memory/constitution.md` + `.claude/rules/` (NestJS 11 hexagonal + CQRS, TypeORM, `CachingQueryBus`)

---

## 1. Overview

Add a read-only CQRS query that, given a manual simulation ID, returns the simulation identity together with every `Prediction` linked to it and each prediction's ordered `PredictionResult` time-series. Endpoint: `GET /simulations/manual/:id/results`.

No schema changes. Reuses existing entities (`Simulation`, `Prediction`, `PredictionResult`, `PredictionType`).

---

## 2. API Contract

### Endpoint

```
GET /simulations/manual/:id/results
```

### Path parameters

| Name | Type | Notes |
|------|------|-------|
| `id` | UUID | Manual simulation identifier |

### Success response — 200 OK

```jsonc
{
  "simulation": {
    "id": "uuid",
    "simulationDate": "YYYYMMDDHHMMSS",
    "status": "CREATED | MODEL_PROCESSING | IN_PROGRESS | FINALIZED | MODEL_FAILED",
    "type": "MANUAL",
    "dataOrigin": "FORECAST" | "HISTORICAL" | null,
    "createdAt": "2026-07-10T12:34:56.000Z",
    "updatedAt": "2026-07-10T12:35:12.000Z"
  },
  "predictions": [
    {
      "id": "uuid",
      "stationId": "AR71",
      "stationName": "…",
      "predictionTypeId": "uuid",
      "predictionTypeName": "Q.NAM.forecast",
      "predictionTypeUnit": "m3/s",
      "percentile": 50,          // may be null
      "predictionProvider": "aemet",
      "predictedBy": "mod-1",
      "predictionDate":     "2026-07-10T00:00:00.000Z",
      "predictionStartDate":"2026-07-10T00:00:00.000Z",
      "predictionEndDate":  "2026-07-13T00:00:00.000Z",
      "results": [
        { "date": "2026-07-10T00:00:00.000Z", "value": 123.4, "flag": 0 },
        { "date": "2026-07-10T01:00:00.000Z", "value": 118.7, "flag": 0 }
      ]
    }
  ]
}
```

Ordering:
- `predictions[]` sorted ascending by `(stationId, predictionTypeId)`.
- Each `predictions[i].results[]` sorted ascending by `date`.

### Error responses

| Status | When |
|--------|------|
| 400 | `id` is not a valid UUID |
| 404 | Simulation not found, soft-deleted, or `type !== MANUAL` |
| 500 | Repository / unexpected error |

Body follows the existing `HttpExceptionFilter` shape: `{ StatusCode, ErrorCode, ErrorDescription }`.

---

## 3. Architecture (CQRS + Hexagonal)

```
Controller  ──> Mapper.toQuery(id) ──> CachingQueryBus.execute
                                              │
                                        GetSimulationResultsQuery
                                              │
                                     GetSimulationResultsHandler
                                              │
                            ┌─────────────────┼─────────────────┐
                            ▼                                   ▼
                 ISimulationRepository.findById       IPredictionRepository
                            │                          .findWithResultsBySimulationId
                            │                                   │
                            └──────────┐    ┌───────────────────┘
                                       ▼    ▼
                             SimulationResultsResult (domain result)
                                       │
                       Mapper.toResponseDto(result)
                                       │
                       GetSimulationResultsResponseDto  ──> 200
```

Existing method reuse:
- `ISimulationRepository.findById(id)` — already exists, throws on not-found (caught → 404).
- `IPredictionRepository.findBySimulationId(id)` — already exists but loads only `results` (not `predictionType`) and does not sort. We add a NEW method for this feature to avoid changing shared behavior (see §4).

---

## 4. Files to add / modify

### Domain

- **NEW** `src/app/domain/results/simulation-results.result.ts`
  ```ts
  export class SimulationResultsResult {
      readonly simulation: Simulation;
      readonly predictions: Prediction[];  // each with .results (sorted) and .predictionType eagerly loaded
      constructor(params: { simulation: Simulation; predictions: Prediction[] });
  }
  ```
- **MODIFY** `src/app/domain/ports/prediction-repository.port.ts` — add abstract method:
  ```ts
  abstract findWithResultsBySimulationId(simulationId: string): Promise<Prediction[]>;
  ```

### Infrastructure

- **MODIFY** `src/app/infrastructure/persistence/prediction.repository.ts` — implement `findWithResultsBySimulationId`:
  - QueryBuilder joining `prediction.simulation`, `prediction.predictionType`, `prediction.results`
  - WHERE `prediction.simulationId = :id`
  - ORDER BY `prediction.stationId ASC, prediction.predictionTypeId ASC, results.date ASC`
  - Returns `Prediction[]` with `predictionType` and `results` populated
- **MODIFY** `src/app/infrastructure/cache/cache-config.registry.ts`:
  - Add `results(id)` key to `ManualSimulationCacheKeys` → `manual-simulation:results:${id}` (falls under existing `manual-simulation:*` pattern, so the existing `ManualSimulationCacheKeys.pattern()` invalidation still applies).
  - Register `GetSimulationResultsQuery` in `CACHE_REGISTRY` with `ttl: 60`.
- **MODIFY** `src/app/application/commands/prediction.commands.ts` — `ProcessTimeSeriesHandler.execute` currently invalidates `SimulationCacheKeys.pattern()` and `PredictionCacheKeys.pattern()`; extend it to also invalidate `ManualSimulationCacheKeys.pattern()` so the new results cache is cleared when new predictions are persisted for a manual simulation.

### Application

- **NEW** in `src/app/application/queries/manual-simulation.queries.ts` (append to existing file, follow section-divider style):
  - `IGetSimulationResultsQuery { id: string }`
  - `GetSimulationResultsQuery` (constructor + getter)
  - `@QueryHandler(GetSimulationResultsQuery) GetSimulationResultsHandler`
    - injects `ISimulationRepository` and `IPredictionRepository`
    - looks up simulation → 404 if missing / soft-deleted / not `MANUAL`
    - calls `predictionRepository.findWithResultsBySimulationId(id)`
    - returns `new SimulationResultsResult({ simulation, predictions })`
- **NEW** in `src/app/application/mappers/manual-simulation.mappers.ts` (append):
  - `GetSimulationResultsMapper.toQuery(id): GetSimulationResultsQuery`
  - `GetSimulationResultsMapper.toResponseDto(result): GetSimulationResultsResponseDto`

### API

- **NEW** DTOs in `src/app/api/dtos/simulation.dtos.ts` (append):
  - `PredictionResultItemDto` — { date, value, flag }
  - `PredictionResultDto` — the per-prediction block described in §2
  - `GetSimulationResultsResponseDto` — { simulation, predictions[] }
  - All fields decorated with `@ApiProperty` (response DTOs only, no `class-validator`)
- **MODIFY** `src/app/api/controllers/simulation.controller.ts`:
  - Add `@Get('manual/:id/results')` — **must be declared BEFORE `@Get(':simulationDate')`** to avoid the catch-all shadowing it (mirrors existing `@Get('manual')`, `@Get('manual/:id')`, `@Get(':id/files')` all declared before `:simulationDate`).
  - UUID validation via `isUUID(id)` → 400 (same pattern as `listSimulationFiles`)
  - Try/catch mapping: `ApiError` → `error.statusCode`, `EntityError` → 400, fallback → 500

### Module wiring

- **MODIFY** `src/app/application/application.module.ts` — register `GetSimulationResultsHandler` in the providers array (alongside `GetManualSimulationByIdHandler`).

---

## 5. Data Model

Unchanged. Uses:
- `simulations` (existing).
- `predictions` (existing, FK `simulationId`).
- `prediction_results` (existing, FK `predictionId`).
- `prediction_types` (existing).

**No migration.**

---

## 6. Cache Behavior

| Aspect | Value |
|--------|-------|
| Query cache key | `manual-simulation:results:{simulationId}` (via `ManualSimulationCacheKeys.results(id)`) |
| TTL | 60 s |
| Invalidation triggers | (1) `ProcessTimeSeriesHandler` when new predictions land for a simulation; (2) any command that already invalidates `ManualSimulationCacheKeys.pattern()` (e.g. finalize/delete/status-update) |

The extra `delByPattern(ManualSimulationCacheKeys.pattern())` in `ProcessTimeSeriesHandler` is broad (invalidates every manual-simulation cache entry), which is acceptable because the volume of manual simulations is small.

---

## 7. Observability

- Logger `nestjs-pino` with `traceId` bound via CLS (already handled by existing middleware).
- Structured log line inside the handler: `event: query.simulation-results.executed`, includes `simulationId`, `predictionsCount`, `totalResults`.
- Errors logged with `event: query.simulation-results.error` and stringified error.

No new events, no new AMQP queues.

---

## 8. Testing Strategy

### Unit tests

- None required beyond what the e2e already covers; keep the handler thin so integration tests are authoritative (project convention, see `.claude/rules/05-testing.md`).

### E2E (integration) — `test/modules/manual-simulation/get-simulation-results.e2e-spec.ts`

Follow the `get-manual-simulation.e2e-spec.ts` pattern:
- Real Postgres via Testcontainers (`createTestApp`).
- Mock `ISimulationSftpService`, `IMessageBroker`, `ICacheService`.
- Register the entities: `Simulation`, `Maneuver`, `Prediction`, `PredictionType`, `PredictionResult`.
- Register handlers: `CreateManualSimulationHandler`, `GetSimulationResultsHandler`, plus process-timeseries handler for seeding predictions.

Scenarios:
1. **Happy path** — create a manual simulation, seed predictions + results (via `ProcessTimeSeriesCommand` or repository-level fixtures), GET returns 200 with sorted predictions and sorted result entries.
2. **Empty predictions** — create a manual simulation with no predictions ingested, GET returns 200 with `predictions: []` and current simulation status.
3. **Non-manual simulation** — create an AUTOMATIC simulation, GET the results endpoint by its id → 404.
4. **Missing simulation** — GET with a random UUID → 404.
5. **Invalid UUID** — GET `/simulations/manual/not-a-uuid/results` → 400.

Optional smoke scenario (P2):
6. **Ordering** — seed two stations with two prediction types each and multiple time-series entries; assert the predictions and results are in the expected order.

### Manual invocation example

- **NEW** `docs/examples/simulation-results-endpoint.md` (repo root docs/examples) — includes:
  - Prerequisite: run the existing manual-simulation example that leaves a FINALIZED simulation in the DB.
  - `curl` command to hit `http://localhost:3007/simulations/manual/<id>/results`.
  - Sample abbreviated JSON response.

---

## 9. Definition of Done

- [ ] All new/modified files listed in §4 exist and compile (`npm run build` inside `ms-predictions-api`).
- [ ] `npm run lint` and `npm run format` clean.
- [ ] `npm run test:e2e -- --testPathPattern=get-simulation-results` passes.
- [ ] Existing e2e suite (`npm run test:e2e`) still passes.
- [ ] Swagger at `/docs` shows the new endpoint with schemas + errors.
- [ ] Example docs file present at `docs/examples/simulation-results-endpoint.md`.
- [ ] No changes to `ms-gateway-api`, `vsad-tajo-frontend`, or any other service in this PR (those belong to follow-up specs).
