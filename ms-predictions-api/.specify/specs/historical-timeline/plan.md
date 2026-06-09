# Implementation Plan: Historical Observed Timeline

**Branch**: `feature/historical-timeline` | **Date**: 2026-06-08 | **Spec**: `./spec.md`
**Service**: `ms-predictions-api` (with coordinated change in `vsad-tajo-frontend`)

## Summary

Replace the existing `GET /predictions/historical` endpoint with one that reconstructs the deduplicated observed timeline for a single station, a single prediction type, and a closed date range. Deduplication picks `MAX(prediction_results.createdAt)` per `date`; ties break by higher `id` (BIGSERIAL). The response shape changes from a nested list of predictions to a flat `{ stationId, predictionType, results: [{ date, value, flag }] }`. The Vue 3 frontend consumer is migrated in the same release window.

## Technical Context

- **Language**: TypeScript 5.7+ strict on Node.js >= 22 (NestJS 11) + Vue 3.5 / TypeScript 5.7 on the frontend.
- **Primary deps**: `@nestjs/cqrs`, TypeORM 0.3, class-validator, `nestjs-pino`, `ky` on the frontend.
- **Storage**: PostgreSQL 16 (`infra-db-predictions`, port 5437). Tables involved: `predictions`, `prediction_results`, `prediction_types`. Existing index `IDX_prediction_results_date_created` on `(date, createdAt)` directly supports the dedup query.
- **Caching**: Redis 7 via `CachingQueryBus`. Same key family (`predictions:historical:<filters>`), TTL 60s. No invalidation paths change because the underlying mutation paths and command handlers stay untouched.
- **Testing**: Jest 29 + Supertest + `@testcontainers/postgresql` for backend; Vitest 3 for the frontend.
- **Performance goal**: < 2s p95 for a typical one-month range on a single station/type.
- **Scale**: Single station, single type per request; one to three months typical, up to one year tolerated.

## Constitution Check

| Principle | Compliance |
|-----------|------------|
| I. Hexagonal architecture | New behavior lives in the existing layers: DTO + controller in `api/`, query + handler in `application/`, repository SQL in `infrastructure/`, port + result in `domain/`. No layer crossings. |
| II. CQRS | Read-only path: `CachingQueryBus.execute(GetHistoricalPredictionsQuery)` — same query class name, narrowed semantics. |
| III. Ports as abstract classes | `IPredictionRepository.findHistorical` signature changes; binding in `infrastructure.module.ts` is unchanged. |
| IV. Domain-driven validation | Required-field and date-format checks happen in the DTO via `class-validator`. No domain invariants to enforce since this is a read. |
| V. Integration testing through endpoints | New e2e test composes the app via `createTestApp()`, ingests fixture rows via the existing command path or seed inserts via TypeORM `dataSource.query`, then asserts only through `GET /predictions/historical`. |
| VI. Strict TypeScript + path aliases | All `src/` imports use `@api/*`, `@domain/*`, etc. Test imports stay relative. |
| VII. Structured error hierarchy | `RepositoryError` wraps the SQL call. Controller maps `EntityError` → 400 and `ApiError` → as-is. |

No violations. No additional gates required.

## Project Structure

### Files changed in `ms-predictions-api`

```text
ms-predictions-api/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── controllers/prediction.controller.ts                # Unchanged file, controller method body unchanged
│   │   │   └── dtos/prediction.dtos.ts                             # Tighten HistoricalPredictionsQueryDto, rewrite HistoricalPredictionsResponseDto
│   │   ├── application/
│   │   │   ├── mappers/prediction.mappers.ts                       # Rewrite HistoricalPredictionsMapper.toResponseDto; decouple Raw/Forecast mappers from it
│   │   │   └── queries/prediction.queries.ts                       # Rewrite GetHistoricalPredictionsHandler (no longer hydrates Prediction entities)
│   │   ├── domain/
│   │   │   ├── ports/prediction-repository.port.ts                 # Change findHistorical signature to return HistoricalTimelinePoint[]
│   │   │   └── results/historical-predictions.result.ts            # Rewrite result shape
│   │   └── infrastructure/
│   │       ├── persistence/prediction.repository.ts                # Rewrite findHistorical using DISTINCT ON
│   │       └── cache/cache-config.registry.ts                      # Tweak filter serialization (keys keep the same prefix)
│   └── test/
│       ├── factories/historical-timeline.factory.ts                # NEW — helpers to insert predictions and results with controlled createdAt
│       └── modules/predictions/get-historical-timeline.e2e-spec.ts # NEW — covers all acceptance scenarios from spec
└── .specify/specs/historical-timeline/                             # spec.md, plan.md, tasks.md
```

### Files changed in `vsad-tajo-frontend`

```text
vsad-tajo-frontend/
└── src/
    ├── types/Predictions.ts                # Widen HistoricalPredictionTypeName to string; add HistoricalTimelineResponse + TimelinePoint
    └── services/predictions.ts             # Rewrite getHistoricalPredictionService to consume the flat shape and accept arbitrary type
```

## Phase 0 — Research (resolved upfront)

- **Why `DISTINCT ON` over a window function**: Postgres-native, uses the existing `(date, createdAt)` index directly, and is the canonical idiom for "max per group". Window functions (`ROW_NUMBER() OVER (PARTITION BY date ORDER BY createdAt DESC)`) work but force a sort pass even when the index is sufficient.
- **Why drop the `LIKE '%historical%'` filter**: The previous filter was implicit and consumer-coupled. The new endpoint exposes `predictionType` as an exact match — the consumer is responsible for picking the type name, which matches how the frontend already builds requests.
- **Why no pagination**: Two arguments. (a) Consumer always renders a bounded window (one to three months), well below any reasonable payload limit. (b) Server-side dedup on `date` puts a tight upper bound on the result count — at most one row per timestamp resolution present in the source, which for hourly data is 720 per month.
- **Why keep `GetHistoricalPredictionsQuery` as the class name**: Existing `CACHE_REGISTRY` keys by class name. Reusing the name keeps cache config local. The query's `filters` field is what changes shape — `JSON.stringify(filters)` already produces stable keys.

## Phase 1 — Design

### Data model

No schema migration. Reuses three tables already in place:

```
prediction_types (id uuid PK, name varchar UNIQUE, unit varchar)
predictions      (id uuid PK, stationId varchar, predictionTypeId uuid FK, simulationId uuid FK, ...)
prediction_results
    (id BIGSERIAL PK, predictionId uuid FK, date TIMESTAMP, value double precision, flag int, createdAt TIMESTAMP)
    indexes: (predictionId, date), (date, createdAt)
```

### Canonical SQL (executed by the new `findHistorical`)

```sql
SELECT DISTINCT ON (r.date)
    r.date  AS "date",
    r.value AS "value",
    r.flag  AS "flag"
FROM prediction_results r
INNER JOIN predictions p       ON p.id  = r."predictionId"
INNER JOIN prediction_types pt ON pt.id = p."predictionTypeId"
WHERE p."stationId" = $1
  AND pt.name       = $2
  AND r.date >= $3
  AND r.date <= $4
ORDER BY r.date ASC, r."createdAt" DESC, r.id DESC
```

Returns rows as `{ date: Date, value: number, flag: number }`. The repository converts to the domain shape and returns; no entity hydration. Empty result is an empty array — never throws.

### Domain layer

`src/app/domain/results/historical-predictions.result.ts`:

```ts
export interface IHistoricalTimelinePoint {
    date: string;   // ISO 8601 UTC
    value: number;
    flag: number;
}

export class HistoricalPredictionsResult {
    constructor(
        public readonly stationId: string,
        public readonly predictionType: string,
        public readonly results: IHistoricalTimelinePoint[],
    ) {}
}
```

`src/app/domain/ports/prediction-repository.port.ts`:

```ts
export interface HistoricalTimelineFilters {
    stationId: string;       // required
    predictionType: string;  // required
    startDate: string;       // ISO 8601, required
    endDate: string;         // ISO 8601, required
}

export abstract class IPredictionRepository {
    // ... existing members unchanged
    abstract findHistorical(filters: HistoricalTimelineFilters): Promise<IHistoricalTimelinePoint[]>;
}
```

The old `PredictionFilters` interface is removed; nothing else used its optional shape.

### Application layer

`GetHistoricalPredictionsQuery`:

```ts
export interface IGetHistoricalPredictionsQuery {
    filters: HistoricalTimelineFilters;
}

export class GetHistoricalPredictionsQuery {
    constructor(private readonly parameters: IGetHistoricalPredictionsQuery) {}
    get filters(): HistoricalTimelineFilters { return this.parameters.filters; }
}
```

Handler:

```ts
async execute(query: GetHistoricalPredictionsQuery): Promise<HistoricalPredictionsResult> {
    const points = await this.predictionRepository.findHistorical(query.filters);
    return new HistoricalPredictionsResult(
        query.filters.stationId,
        query.filters.predictionType,
        points.map(p => ({ date: p.date.toISOString(), value: p.value, flag: p.flag })),
    );
}
```

### API layer

`HistoricalPredictionsQueryDto`:

```ts
export class HistoricalPredictionsQueryDto {
    @IsNotEmpty() @IsString()                   stationId!: string;
    @IsNotEmpty() @IsString()                   predictionType!: string;
    @IsNotEmpty() @IsISO8601({ strict: true })  startDate!: string;
    @IsNotEmpty() @IsISO8601({ strict: true })  endDate!: string;
}
```

`HistoricalPredictionsResponseDto`:

```ts
export class HistoricalTimelinePointDto {
    @ApiProperty() date: string;
    @ApiProperty() value: number;
    @ApiProperty() flag: number;
}
export class HistoricalPredictionsResponseDto {
    @ApiProperty() stationId: string;
    @ApiProperty() predictionType: string;
    @ApiProperty({ type: [HistoricalTimelinePointDto] }) results: HistoricalTimelinePointDto[];
}
```

Controller body (`prediction.controller.ts:147`) is structurally unchanged — same mapper, same `cachingQueryBus.execute`, same try/catch chain. Swagger description text adjusted to mention the deduplicated timeline contract.

### Mapper

`HistoricalPredictionsMapper.toResponseDto` returns the flat shape. The current cross-use of this mapper by `RawPredictionsMapper.toResponseDto` (`prediction.mappers.ts:71-73`) and `ForecastPredictionsMapper.toResponseDto` (`prediction.mappers.ts:92-94`) is **deleted**. Raw and Forecast endpoints retain their original nested shape and get their own dedicated `toResponseDto` methods that reproduce the old logic from `mapPredictionToItem` (this logic stays alive inside `prediction.queries.ts` because Raw and Forecast still hydrate `Prediction` entities).

### Cache

`cache-config.registry.ts` entry:

```ts
[GetHistoricalPredictionsQuery.name, {
    ttl: 60,
    key: (q: GetHistoricalPredictionsQuery) =>
        PredictionCacheKeys.historical(JSON.stringify(q.filters)),
}]
```

Same shape, same TTL. Filters now contain four required fields, so all generated keys are well-formed strings of stable length. Acceptable.

### Frontend coordination

`vsad-tajo-frontend/src/types/Predictions.ts`:

```ts
export type HistoricalPredictionTypeName = string; // was a union of two literals — now any
export interface HistoricalTimelinePoint { date: string; value: number; flag: number }
export interface HistoricalTimelineResponse {
    stationId: string;
    predictionType: string;
    results: HistoricalTimelinePoint[];
}
```

`vsad-tajo-frontend/src/services/predictions.ts` — `getHistoricalPredictionService` becomes:

```ts
export async function getHistoricalPredictionService(
    stationId: string,
    predictionType: string,
    startDate: string,
    endDate: string,
): Promise<HistoricalTimelineResponse> {
    return api.get('predictions/historical', {
        searchParams: { stationId, predictionType, startDate, endDate },
        headers: { Accept: 'application/json' },
    }).json<HistoricalTimelineResponse>();
}
```

Callers downstream of this service may render the points directly — no need for the previous `predictions[0].results` indirection. Any callers that destructured the old shape get updated as part of this PR.

## Phase 2 — Testing strategy

### Backend integration tests (Jest + Testcontainers)

One e2e file `test/modules/predictions/get-historical-timeline.e2e-spec.ts` with cases:

1. **Single prediction, no duplicates** — three results in window → expect three points in order.
2. **Two predictions overlapping same date** — same `date` in both, second has later `createdAt` → expect the second value.
3. **Same prediction, re-ingest** — two `prediction_results` rows with same `date`, different `createdAt` → expect the later one.
4. **Tie on `createdAt`** — two rows with identical `createdAt` → expect the row with higher `id`.
5. **Empty range** — no candidate rows → expect 200, empty `results`, echoed `stationId` and `predictionType`.
6. **Unknown station / unknown type** — 200 with empty `results`.
7. **Inverted range** (`startDate > endDate`) — 200 with empty `results`.
8. **Missing parameter** — 400 each: no `stationId`, no `predictionType`, no `startDate`, no `endDate`.
9. **Invalid ISO date** — 400.
10. **Inclusive boundary** — a result with `date === startDate` is included; same for `endDate`.

Fixtures insert rows directly through `dataSource.query` to control `createdAt` precisely (the existing command path stamps `createdAt = now()` which is not deterministic enough for these tests). This is the one allowed deviation from "no direct DB access" — fixture setup, not assertion.

### Frontend unit tests (Vitest)

A single spec on `getHistoricalPredictionService` that mocks `ky` and asserts:
- It calls `predictions/historical` with the four params verbatim.
- It returns the parsed `HistoricalTimelineResponse`.
- It does not throw on empty `results`.

## Phase 3 — Migration / rollout

- Both PRs (`ms-predictions-api` and `vsad-tajo-frontend`) target `main` and are reviewed in parallel.
- Merge order: backend first, then frontend within the same Jenkins window (Jenkins deploys each repo independently — the gap is small, and the existing in-flight frontend keeps using the old shape only until its own deploy completes; observed during that gap the chart shows stale data, not crashes, because the response shape changes but `getHistoricalPredictionService` would attempt to read `predictions[]` and surface an empty array via `?.predictions`. To be safe we ship the frontend within an hour of the backend; the alternative is feature-flagging, deemed overkill for this size of change).
- No DB migration. Cache TTL is 60s, so any stale entries clear themselves quickly after deploy.
- Smoke test on production: open the observed-discharge chart for one station, confirm the curve renders, then open the synthetic series (`WI__01.historical`) page.

## Risks and unknowns

| Risk | Mitigation |
|------|------------|
| External (out-of-repo) caller depending on the old shape | Grep confirmed no callers outside `vsad-tajo-frontend`. The endpoint is behind the API gateway and serves internal Vue 3 only. |
| Postgres collation or timezone surprise on `r.date` comparisons | `r.date` is `TIMESTAMP` without time zone. Inputs are validated as ISO 8601 by class-validator; TypeORM passes them as parameterized values. We document UTC as the canonical interpretation in the spec and let the DB compare as wall time. |
| Large date windows producing slow queries | Existing `(date, createdAt)` index supports the dedup. Single-station filter pushes `predictions` join below 1k rows in steady state. If the query proves slow at scale, a covering index `(predictionTypeId, stationId, date, createdAt)` on `predictions` joined to `prediction_results` would be the follow-up — not in scope here. |
| Behavior on inverted range silently returning `[]` | Documented as a deliberate decision in `spec.md`. Callers can detect malformed ranges client-side before issuing the call. |
