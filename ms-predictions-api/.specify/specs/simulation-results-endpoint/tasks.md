# Tasks — Simulation Results Endpoint

**Feature**: `simulation-results-endpoint`
**Service**: `ms-predictions-api`
**Order**: TDD — tests come first, then implementation.
**Legend**: `[TEST]` = test task, `[P]` = safe to parallelize.

---

## Phase 1 — Test Scaffold

### T001 [TEST] — Add e2e test file skeleton
Path: `ms-predictions-api/test/modules/manual-simulation/get-simulation-results.e2e-spec.ts`
Content: `describe('Get Simulation Results (e2e)', …)`, `beforeAll` composing NestJS module with entities `[Simulation, Maneuver, Prediction, PredictionType, PredictionResult]`, controllers `[SimulationController]`, providers including `GetSimulationResultsHandler` (does not exist yet — this is expected to fail compile at first), `CreateManualSimulationHandler`, `ProcessTimeSeriesHandler`, all repos, `CachingQueryBus`, mocked `ISimulationSftpService`, `IMessageBroker`, `ICacheService`, `IStationThresholdService`. Add empty `it.todo(...)` markers for each of the 5 scenarios below.
Expected: file exists, `npm run test:e2e -- --testPathPattern=get-simulation-results` shows compile error referring to `GetSimulationResultsHandler`.

### T002 [TEST] — Author the 5 failing scenarios (still no impl)
- `it('should return 200 with sorted predictions and results for a manual simulation', …)` — creates a manual sim via POST, seeds two predictions with results via `ProcessTimeSeriesCommand` (or by calling the handler directly), GETs `/simulations/manual/:id/results`, asserts response shape, ordering by `(stationId, predictionTypeId)` and `results` by `date`.
- `it('should return 200 with empty predictions when nothing has been ingested yet', …)` — create manual sim, GET immediately.
- `it('should return 404 when the simulation is not MANUAL', …)` — insert an AUTOMATIC simulation directly via repo (helper), GET → 404.
- `it('should return 404 when the simulation does not exist', …)` — GET a random UUID.
- `it('should return 400 when the id is not a valid UUID', …)` — GET `/simulations/manual/not-a-uuid/results`.
Expected: file compiles once T005–T012 are done; scenarios must FAIL until each corresponding implementation lands (fail-then-pass sequence per scenario).

---

## Phase 2 — Domain

### T003 [P] — Add domain result
Path: `ms-predictions-api/src/app/domain/results/simulation-results.result.ts`
Content:
```ts
import { Simulation } from '@domain/entities/simulation.entity';
import { Prediction } from '@domain/entities/prediction.entity';

export class SimulationResultsResult {
    readonly simulation: Simulation;
    readonly predictions: Prediction[];

    constructor(params: { simulation: Simulation; predictions: Prediction[] }) {
        this.simulation = params.simulation;
        this.predictions = params.predictions;
    }
}
```

### T004 [P] — Extend `IPredictionRepository` port
Path: `ms-predictions-api/src/app/domain/ports/prediction-repository.port.ts`
Add abstract method:
```ts
abstract findWithResultsBySimulationId(simulationId: string): Promise<Prediction[]>;
```
No behavior change to existing `findBySimulationId`.

---

## Phase 3 — Infrastructure

### T005 — Implement `findWithResultsBySimulationId` in `PredictionRepository`
Path: `ms-predictions-api/src/app/infrastructure/persistence/prediction.repository.ts`
Use QueryBuilder:
- `innerJoin('prediction.simulation', 'simulation')`
- `leftJoinAndSelect('prediction.predictionType', 'predictionType')`
- `leftJoinAndSelect('prediction.results', 'result')`
- `where('prediction.simulationId = :id', { id: simulationId })`
- `orderBy('prediction.stationId', 'ASC')`
- `addOrderBy('prediction.predictionTypeId', 'ASC')`
- `addOrderBy('result.date', 'ASC')`
- `getMany()`
Wrap in try/catch, throw `RepositoryError` on failure, log with `event: 'repo.prediction.findWithResultsBySimulationId.error'`.
Expected: scenarios in T002 that depend on repo behavior compile once T004 is done.

### T006 — Register new cache key + registry entry
Path: `ms-predictions-api/src/app/infrastructure/cache/cache-config.registry.ts`
- Extend `ManualSimulationCacheKeys` with:
  ```ts
  results: (id: string) => `manual-simulation:results:${id}`,
  ```
- Import `GetSimulationResultsQuery` from `@application/queries/manual-simulation.queries` and add to `CACHE_REGISTRY`:
  ```ts
  [GetSimulationResultsQuery.name, {
      ttl: 60,
      key: (q: GetSimulationResultsQuery) => ManualSimulationCacheKeys.results(q.id),
  }],
  ```

### T007 — Extend `ProcessTimeSeriesHandler` cache invalidation
Path: `ms-predictions-api/src/app/application/commands/prediction.commands.ts` (around the existing invalidation block, ~line 259–261).
Add:
```ts
await this.cacheService.delByPattern(ManualSimulationCacheKeys.pattern());
```
alongside the existing `SimulationCacheKeys.pattern()` and `PredictionCacheKeys.pattern()` invalidations.
Import `ManualSimulationCacheKeys` from the cache registry.

---

## Phase 4 — Application

### T008 — Query + Handler
Path: `ms-predictions-api/src/app/application/queries/manual-simulation.queries.ts` (append below existing `ListManualSimulationsHandler`, with the section-divider style already used in the file).
Contents:
```ts
// ─────────────────────────────────────────────────────────────
// GetSimulationResults
// ─────────────────────────────────────────────────────────────

export interface IGetSimulationResultsQuery { id: string }

export class GetSimulationResultsQuery {
    constructor(private readonly parameters: IGetSimulationResultsQuery) {}
    get id(): string { return this.parameters.id; }
}

@QueryHandler(GetSimulationResultsQuery)
export class GetSimulationResultsHandler implements IQueryHandler<GetSimulationResultsQuery, SimulationResultsResult> {
    constructor(
        @Inject(Logger) private readonly logger: Logger,
        private readonly simulationRepository: ISimulationRepository,
        private readonly predictionRepository: IPredictionRepository,
    ) {}

    async execute(query: GetSimulationResultsQuery): Promise<SimulationResultsResult> {
        let simulation;
        try {
            simulation = await this.simulationRepository.findById(query.id);
        } catch {
            throw new ApiError(HttpStatus.NOT_FOUND, `Manual simulation with id "${query.id}" not found`);
        }
        if (!simulation || simulation.type !== SimulationType.MANUAL) {
            throw new ApiError(HttpStatus.NOT_FOUND, `Manual simulation with id "${query.id}" not found`);
        }

        const predictions = await this.predictionRepository.findWithResultsBySimulationId(query.id);

        this.logger.debug({
            event: 'query.simulation-results.executed',
            simulationId: query.id,
            predictionsCount: predictions.length,
            totalResults: predictions.reduce((sum, p) => sum + (p.results?.length ?? 0), 0),
        });

        return new SimulationResultsResult({ simulation, predictions });
    }
}
```
Import `SimulationResultsResult`, `IPredictionRepository`.

### T009 — Mapper
Path: `ms-predictions-api/src/app/application/mappers/manual-simulation.mappers.ts` (append with section divider).
```ts
// ─────────────────────────────────────────────────────────────
// GetSimulationResults
// ─────────────────────────────────────────────────────────────

export class GetSimulationResultsMapper {
    static toQuery(id: string): GetSimulationResultsQuery {
        return new GetSimulationResultsQuery({ id });
    }

    static toResponseDto(result: SimulationResultsResult): GetSimulationResultsResponseDto {
        return {
            simulation: {
                id: result.simulation.id,
                simulationDate: result.simulation.simulationDate,
                status: result.simulation.status,
                type: result.simulation.type,
                dataOrigin: result.simulation.dataOrigin ?? null,
                createdAt: result.simulation.createdAt,
                updatedAt: result.simulation.updatedAt,
            },
            predictions: result.predictions.map((p) => ({
                id: p.id,
                stationId: p.stationId,
                stationName: p.stationName,
                predictionTypeId: p.predictionTypeId,
                predictionTypeName: p.predictionType?.name ?? null,
                predictionTypeUnit: p.predictionType?.unit ?? null,
                percentile: p.percentile !== null && p.percentile !== undefined ? Number(p.percentile) : null,
                predictionProvider: p.predictionProvider,
                predictedBy: p.predictedBy,
                predictionDate: p.predictionDate,
                predictionStartDate: p.predictionStartDate,
                predictionEndDate: p.predictionEndDate,
                results: (p.results ?? []).map((r) => ({
                    date: r.date,
                    value: typeof r.value === 'string' ? Number(r.value) : r.value,
                    flag: r.flag,
                })),
            })),
        };
    }
}
```

---

## Phase 5 — API

### T010 — DTOs
Path: `ms-predictions-api/src/app/api/dtos/simulation.dtos.ts` (append with section divider).
Add:
- `PredictionResultItemDto { date: Date; value: number; flag: number }`
- `PredictionWithResultsDto` (fields as described in plan §2)
- `SimulationIdentityDto` (id, simulationDate, status, type, dataOrigin, createdAt, updatedAt)
- `GetSimulationResultsResponseDto { simulation: SimulationIdentityDto; predictions: PredictionWithResultsDto[] }`
Every field decorated with `@ApiProperty(...)`. No `class-validator` on responses.

### T011 — Controller endpoint
Path: `ms-predictions-api/src/app/api/controllers/simulation.controller.ts`
- **BEFORE the `@Get(':simulationDate')` endpoint**, add:
```ts
@Get('manual/:id/results')
@ApiEndpoint({
    summary: 'Get the predictions and time-series results of a manual simulation',
    response: {
        status: 200,
        type: GetSimulationResultsResponseDto,
        description: 'Predictions and their time-series results for the simulation',
    },
    errors: [
        { status: 400, description: 'Invalid simulation id' },
        { status: 404, description: 'Manual simulation not found' },
    ],
})
async getManualResults(@Param('id') id: string): Promise<GetSimulationResultsResponseDto> {
    this.logger.log(`Get simulation results request: ${id}`);
    if (!isUUID(id)) {
        throw new HttpException('Invalid simulation id', HttpStatus.BAD_REQUEST);
    }
    try {
        const query = GetSimulationResultsMapper.toQuery(id);
        const result = await this.cachingQueryBus.execute<SimulationResultsResult>(query);
        return GetSimulationResultsMapper.toResponseDto(result);
    } catch (error) {
        if (error instanceof EntityError) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        if (error instanceof ApiError) throw new HttpException(error.message, error.statusCode);
        this.logger.error({ msg: 'Get simulation results error', entity: 'Simulations', error: String(error) });
        throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
```
- Add imports: `GetSimulationResultsMapper`, `SimulationResultsResult`, `GetSimulationResultsResponseDto`.

### T012 — Wire handler in application module
Path: `ms-predictions-api/src/app/application/application.module.ts`
- Import `GetSimulationResultsHandler` from `@application/queries/manual-simulation.queries`.
- Add it to the providers array (next to `GetManualSimulationByIdHandler`).

---

## Phase 6 — Verify & Docs

### T013 [TEST] — All e2e scenarios pass
Run `npm run test:e2e -- --testPathPattern=get-simulation-results` locally. All 5 (or 6 if the ordering scenario is included) must be green.

### T014 [TEST] — Regression: full suite still green
Run `npm run test:e2e` (all tests). Existing endpoints must continue passing — no drift from the cache-invalidation change in T007 or the port extension in T004.

### T015 — Lint + build
```
npm run lint
npm run build
```
Must be clean.

### T016 [P] — Manual invocation example
Path: `docs/examples/simulation-results-endpoint.md` (at monorepo root `docs/examples/`).
Include:
- Short intro linking to the existing manual-simulation flow (`docs/flows/manual-simulation.md`).
- Prerequisites (stack up via `run-monorepo-local` skill, seed a manual simulation to FINALIZED).
- `curl` invocation with placeholder `<SIMULATION_ID>` and the direct predictions-api port (`3007`).
- Sample abbreviated response.
- Note that the gateway proxy (`ms-gateway-api`) and frontend consumer (`vsad-tajo-frontend`) will be added in follow-up specs.

### T017 — Swagger sanity check
Start the service in dev mode locally (or rely on the `/docs` swagger route in CI health checks) and confirm the new endpoint appears with the documented request/response schemas.

---

## Dependency Graph

```
T001 ─┐
T002 ─┼─▶ T005..T012 (implementation, in order) ─▶ T013 ─▶ T014 ─▶ T015 ─▶ T017
T003 ─┘
T004 ─▶ T005, T008
T005, T006 ─▶ T007
T008 ─▶ T009 ─▶ T010 ─▶ T011 ─▶ T012

T016 is independent and can run in parallel with any Phase 3–5 task once T011 lands (endpoint path settled).
```

---

## Notes for the implementer

- Follow the existing section-divider comment style (`// ─────────────────────────────────────────────────────────────` + name) when appending to `manual-simulation.queries.ts`, `manual-simulation.mappers.ts`, and `simulation.dtos.ts`.
- The `IsUUID` check MUST come before the try/catch (see `listSimulationFiles` in the same controller).
- Register the new route BEFORE the catch-all `@Get(':simulationDate')` route to avoid path shadowing.
- Do not modify `findBySimulationId` in `PredictionRepository`; add the new `findWithResultsBySimulationId` alongside it.
- Do not create a migration — there are no schema changes.
- Keep the payload flat: no maneuvers in this response (see spec design decision #2).
