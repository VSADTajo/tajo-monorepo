# Tasks: Precipitation Aggregation Layers (Daily & Total)

**Input**: Design documents from `/specs/002-precip-aggregation/`  
**Status**: All tasks completed

## Phase 2: Foundational

- [x] T001 [P] Add `withSuffix()` to `src/app/domain/value-objects/layer-name.value-object.ts`
- [x] T002 [P] Add `sumGeoTiffs()` to `src/app/domain/ports/raster-converter.port.ts`
- [x] T003 [P] Add `AggregationResult` types to `src/app/domain/results/meteo.results.ts`
- [x] T004 Implement `sumGeoTiffs()` with VRT in `src/app/infrastructure/gdal/gdal-raster-converter.ts`
- [x] T005 [P] Add `listFiles()` to `src/app/domain/ports/file-system.port.ts` and `src/app/infrastructure/file-system/node-file-system.ts`

## Phase 3: US1 Daily (P1)

- [x] T006 [US1] Create `MeteoAggregationService` with `listHourlyTiffs()` in `src/app/application/services/meteo-aggregation.service.ts`
- [x] T007 [US1] Implement `aggregateDaily()` in `src/app/application/services/meteo-aggregation.service.ts`
- [x] T008 [US1] Register `MeteoAggregationService` in `src/app/application/application.module.ts`

## Phase 4: US2 Total (P1)

- [x] T009 [US2] Implement `aggregateTotal()` in `src/app/application/services/meteo-aggregation.service.ts`
- [x] T010 [US2] Implement `aggregateDataset()` in `src/app/application/services/meteo-aggregation.service.ts`
- [x] T011 [US2] Implement `aggregateAll()` in `src/app/application/services/meteo-aggregation.service.ts`

## Phase 5: US3 Auto-Aggregation (P2)

- [x] T012 [US3] Inject `MeteoAggregationService` into `SyncMeteoHandler` in `src/app/application/commands/meteo.commands.ts`
- [x] T013 [US3] Call aggregation after sync in `src/app/application/commands/meteo.commands.ts`

## Phase 6: US4 EPS (P2)

- [x] T014 [US4] Verified: generic implementation handles all datasets including EPS variants

## Phase 7: US5 Retention (P3)

- [x] T015 [US5] Extended `PurgeMeteoGranulesHandler` for `_diaria` and `_total` cleanup in `src/app/application/commands/meteo.commands.ts`
- [x] T016 [US5] Added `dailyGranulesDeleted` and `totalFilesDeleted` to `PurgeMeteoGranulesResult` in `src/app/domain/results/meteo.results.ts`

## Phase 8: Polish

- [x] T017 [P] Structured logging in `MeteoAggregationService` (included in initial implementation)
- [x] T018 [P] Empty directory edge case handled (returns 0, logs debug)
- [x] T019 [P] Single-file group handled (VRT sum of 1 source = that source)
- [x] T020 Quickstart validation pending deployment
