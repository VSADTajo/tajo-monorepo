# Tasks: Historical Observed Timeline

**Feature**: `historical-timeline`
**Plan**: [./plan.md](./plan.md)
**Spec**: [./spec.md](./spec.md)

TDD ordering: each `[TEST]` task lands a failing test, and the implementation task that immediately follows makes it pass. `[P]` marks tasks that can run in parallel with the previous one without conflicting files. Each phase MUST complete (tests green) before moving to the next.

---

## Phase 1 — Domain shape

### T001 [TEST] Add unit test for `HistoricalPredictionsResult` constructor
- **File**: `test/modules/predictions/historical-predictions-result.spec.ts` (NEW)
- **Why**: Pin the result class shape before changing it.
- **Asserts**: Calling `new HistoricalPredictionsResult('AR35', 'Q.historical', [])` exposes `stationId`, `predictionType`, `results` (empty array).

### T002 Refactor `HistoricalPredictionsResult` to flat shape
- **File**: `src/app/domain/results/historical-predictions.result.ts`
- Replace the old `predictions: IHistoricalPredictionItem[]` shape with `{ stationId, predictionType, results: IHistoricalTimelinePoint[] }`. Remove `IHistoricalPredictionItem`. Add `IHistoricalTimelinePoint { date: string; value: number; flag: number }`.
- T001 must now pass.

### T003 [P] Update `IPredictionRepository.findHistorical` signature
- **File**: `src/app/domain/ports/prediction-repository.port.ts`
- Add `HistoricalTimelineFilters` interface with the four required fields.
- Change `findHistorical(filters: PredictionFilters): Promise<Prediction[]>` → `findHistorical(filters: HistoricalTimelineFilters): Promise<IHistoricalTimelinePoint[]>`.
- Remove `PredictionFilters` interface (no other consumers).
- Re-export `IHistoricalTimelinePoint` from the port for convenience.

---

## Phase 2 — Repository implementation

### T004 [TEST] e2e: single prediction, no duplicates returns ordered points
- **File**: `test/modules/predictions/get-historical-timeline.e2e-spec.ts` (NEW)
- **Why**: First green path. Validates wiring end-to-end.
- **Setup**: Insert one `prediction_type` with name `Q.historical`, one `simulation`, one `prediction` for station `AR35`, three `prediction_results` with distinct dates in March 2026.
- **Assert**: `GET /predictions/historical?stationId=AR35&predictionType=Q.historical&startDate=2026-03-01T00:00:00Z&endDate=2026-03-31T23:59:59Z` → 200, `results.length === 3`, dates in ascending order, values intact.

### T005 Rewrite `PredictionRepository.findHistorical`
- **File**: `src/app/infrastructure/persistence/prediction.repository.ts`
- Replace QueryBuilder body with the raw `DISTINCT ON` SQL from `plan.md` using `this.predictionRepository.manager.query(sql, [stationId, predictionType, startDate, endDate])`.
- Map result rows to `IHistoricalTimelinePoint[]`.
- Wrap in try/catch → `RepositoryError('Error reconstructing historical timeline', error)`.
- T004 must now pass.

### T006 [TEST] e2e: dedup across two predictions picks higher `createdAt`
- **File**: same e2e file as T004
- **Setup**: Two predictions for the same `(stationId, predictionType)` from two distinct simulations. Both have a result for `2026-03-10T00:00:00Z`. Use raw `INSERT ... RETURNING` with explicit `createdAt` to make the second one strictly later.
- **Assert**: Exactly one point for `2026-03-10` in the response; `value` matches the second prediction's result.

### T007 [TEST] e2e: dedup within a single prediction picks higher `createdAt`
- **File**: same e2e file
- **Setup**: One prediction, two `prediction_results` rows with identical `date` but different `createdAt`.
- **Assert**: Single point in response with the value from the later row.

### T008 [TEST] e2e: tie on `createdAt` → higher `id` wins
- **File**: same e2e file
- **Setup**: Two `prediction_results` rows with identical `date` AND identical `createdAt` (insert one immediately after the other and force same timestamp).
- **Assert**: Single point with the value from the row whose `id` is higher.

### T009 [TEST] e2e: inclusive boundaries
- **File**: same e2e file
- **Setup**: Insert one result with `date = 2026-03-01T00:00:00Z` (startDate boundary) and one with `date = 2026-03-31T23:59:59Z` (endDate boundary).
- **Assert**: Both points appear in the response.

---

## Phase 3 — API layer

### T010 [TEST] e2e: empty result on no data (200, not 404)
- **File**: same e2e file
- **Cases**: unknown station, unknown type, empty range, inverted range.
- **Assert**: All four return 200, `results: []`, echoed `stationId` and `predictionType`.

### T011 [TEST] e2e: missing required parameter returns 400
- **File**: same e2e file
- **Cases**: omit each of `stationId`, `predictionType`, `startDate`, `endDate`.
- **Assert**: All four return 400.

### T012 [TEST] e2e: invalid ISO date returns 400
- **File**: same e2e file
- **Cases**: `startDate=notadate`, `endDate=2026-13-99`.
- **Assert**: Both return 400.

### T013 Tighten `HistoricalPredictionsQueryDto`
- **File**: `src/app/api/dtos/prediction.dtos.ts`
- Make `stationId` and `predictionType` `@IsNotEmpty() @IsString()`.
- Make `startDate` and `endDate` `@IsNotEmpty() @IsISO8601({ strict: true })`.
- Update `@ApiProperty` to drop the `required: false` flag and adjust example values.
- T011 and T012 must now pass.

### T014 Rewrite `HistoricalPredictionsResponseDto`
- **File**: `src/app/api/dtos/prediction.dtos.ts`
- Add `HistoricalTimelinePointDto { date, value, flag }`.
- Replace `HistoricalPredictionsResponseDto` with `{ stationId, predictionType, results: HistoricalTimelinePointDto[] }`.
- Delete `HistoricalPredictionItemDto` and `PredictionResultItemDto` if unused after this edit (verify with grep).

### T015 Rewrite `HistoricalPredictionsMapper.toResponseDto`
- **File**: `src/app/application/mappers/prediction.mappers.ts`
- New body: spread the `HistoricalPredictionsResult` flat into `HistoricalPredictionsResponseDto`. Update `toQuery` to build the new `HistoricalTimelineFilters`.

### T016 Decouple `RawPredictionsMapper` and `ForecastPredictionsMapper`
- **File**: `src/app/application/mappers/prediction.mappers.ts`
- Inline a local `mapPredictionToItem`-style serialization into each of them so they no longer depend on `HistoricalPredictionsMapper.toResponseDto`.
- Verify Raw and Forecast e2e tests still pass (if they exist; if not, do a smoke `curl` on a seeded fixture).

### T017 Update `GetHistoricalPredictionsHandler`
- **File**: `src/app/application/queries/prediction.queries.ts`
- Drop `mapPredictionToItem` import path for this handler.
- Body: call `predictionRepository.findHistorical(filters)` then wrap in `new HistoricalPredictionsResult(stationId, predictionType, points.map(toIsoString))`.
- Verify the helper `mapPredictionToItem` is still needed by Raw/Forecast handlers; if so, keep it but rename or move to a local file-scoped helper.

### T018 Update Swagger annotations on the controller
- **File**: `src/app/api/controllers/prediction.controller.ts`
- Edit the `@ApiEndpoint` block at line 138 — change `summary` and `response.description` to reflect the new deduplicated-timeline behavior.

---

## Phase 4 — Cache and cleanup

### T019 Verify `cache-config.registry.ts`
- **File**: `src/app/infrastructure/cache/cache-config.registry.ts`
- The entry for `GetHistoricalPredictionsQuery.name` already uses `JSON.stringify(q.filters)`. Confirm the new `HistoricalTimelineFilters` shape serializes deterministically (Object.keys order is stable in V8 for object literals). Add a code comment near the entry documenting the four required fields.

### T020 Remove dead helper code
- **File**: `src/app/application/queries/prediction.queries.ts`
- If `mapPredictionToItem` becomes unused for the historical handler, ensure it is still used by Raw/Forecast handlers (it is — keep it).
- Delete the old `PredictionFilters` interface if no remaining import paths reference it.

### T021 Run the full e2e suite
- **Command**: `npm run test:e2e`
- **Assert**: All tests green, including pre-existing Raw and Forecast suites.

---

## Phase 5 — Frontend coordination

### T022 [TEST] Frontend unit test for `getHistoricalPredictionService`
- **File**: `vsad-tajo-frontend/src/services/predictions.spec.ts` (NEW if absent, otherwise append)
- Mock `api.get`. Assert the function calls `predictions/historical` with the four params verbatim and returns the parsed flat shape.

### T023 Widen `HistoricalPredictionTypeName` and add response types
- **File**: `vsad-tajo-frontend/src/types/Predictions.ts`
- Change `HistoricalPredictionTypeName` from the two-literal union to `string`.
- Add `HistoricalTimelinePoint { date: string; value: number; flag: number }` and `HistoricalTimelineResponse { stationId; predictionType; results: HistoricalTimelinePoint[] }`.

### T024 Rewrite `getHistoricalPredictionService`
- **File**: `vsad-tajo-frontend/src/services/predictions.ts:82-100`
- Require all four params. Use `searchParams: { stationId, predictionType, startDate, endDate }`. Return `Promise<HistoricalTimelineResponse>` parsed via `.json<HistoricalTimelineResponse>()`. Remove the previous fallback that returned `undefined`.
- T022 must now pass.

### T025 Update callers of `getHistoricalPredictionService`
- **Files**: grep `getHistoricalPredictionService(` under `vsad-tajo-frontend/src/`.
- Each call site that destructured `predictions[0].results` MUST change to `response.results`. Each missing-param call site MUST be made to pass all four params.

### T026 Run frontend type-check + tests
- **Commands**: `npm run check` and `npm run test`
- **Assert**: Zero TypeScript errors. All vitest specs green.

---

## Phase 6 — Polish

### T027 [P] Manual smoke against local stack
- Bring up infra + ms-predictions-api + vsad-tajo-frontend per `/start-all`.
- Hit `GET /predictions/historical?stationId=<one with seeded data>&predictionType=Q.historical&startDate=...&endDate=...`.
- Open the corresponding chart in the Vue app and confirm rendering.

### T028 [P] Commit and open PR for `ms-predictions-api`
- Branch: `feature/historical-timeline`. Commit message follows conventional commits (`feat(predictions): reconstruct deduplicated observed timeline`).
- PR body: link to spec/plan files, list breaking change, link to the frontend PR.

### T029 [P] Commit and open PR for `vsad-tajo-frontend`
- Branch: `feature/historical-timeline`. Commit message: `feat(predictions): consume flat historical timeline response`.
- PR body: link to the backend PR, note the breaking-change coordination.

---

## Notes

- Tests in `[TEST]` tasks for the backend MAY be batched into a single PR with their implementation tasks (Jest test files are append-only by convention here).
- Run `npm run lint` after each phase before marking it complete.
- The frontend repo does not have a `.specify/` directory and does not need one — it is a single small change tracked under the backend spec.
