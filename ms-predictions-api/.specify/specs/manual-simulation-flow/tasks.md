# Tasks: Manual Simulation Flow — ms-predictions-api

**Spec**: ms-predictions-api/.specify/specs/manual-simulation-flow/spec.md
**Plan**: ms-predictions-api/.specify/specs/manual-simulation-flow/plan.md
**Created**: 2026-06-19

---

## Phase 0: Setup

- [x] T001: Create migration `add-maneuvers-table` (tabla `maneuvers` con FK a `simulations`, índice en `simulationId`) `src/migrations/<timestamp>-add-maneuvers-table.ts`
- [x] T002: Add `SFTP_API_URL` to `.env.example` and `src/configuration/app/app-config.service.ts` (or new `sftp-api` config module) `src/configuration/`

---

## Phase 1: Foundational

> Toda la capa domain + infrastructure debe estar en pie antes de escribir los primeros tests.

- [x] T010: Implement `Maneuver` entity — `reservoirCode`, `outputFlowValue`, `simulationId` FK + `@ManyToOne` → `Simulation`, `validate()` `src/app/domain/entities/maneuver.entity.ts`
- [x] T011 [P]: Add `@OneToMany(() => Maneuver, m => m.simulation) maneuvers: Maneuver[]` to `Simulation` entity `src/app/domain/entities/simulation.entity.ts`
- [x] T012 [P]: Implement `IManeuverRepository` abstract port — `createMany(maneuvers: Maneuver[]): Promise<Maneuver[]>`, `findBySimulationId(id: string): Promise<Maneuver[]>` `src/app/domain/ports/maneuver-repository.port.ts`
- [x] T013 [P]: Implement `ISimulationSftpService` abstract port — `uploadInputFile(simulationId: string, content: Buffer): Promise<void>` `src/app/domain/ports/simulation-sftp.port.ts`
- [x] T014 [P]: Implement `ManualSimulationResult` — wraps `Simulation` + `Maneuver[]` `src/app/domain/results/manual-simulation.result.ts`
- [x] T015: Implement `ManeuverRepository` — `createMany` (bulk insert), `findBySimulationId`; register `Maneuver` in `TypeOrmModule.forFeature` `src/app/infrastructure/persistence/maneuver.repository.ts`
- [x] T016: Implement `SimulationSftpService` — `POST /files/upload` a ms-sftp-api vía `HttpService` existente; path destino `/simulations/<simulationId>/input/<simulationId>.json`; header `x-internal-caller: ms-predictions-api`; lanza `ProviderError` en fallo `src/app/infrastructure/services/simulation-sftp.service.ts`
- [x] T017 [P]: Update `messaging.registry.ts` — agregar `SIMULATION_EVENTS` exchange con routing keys `simulation.manual.dispatched` y `simulation.status.updated`; nueva queue `PREDICTIONS_SIMULATION_STATUS_UPDATES`; agregar entrada a `TopicSubscriptions` `src/app/infrastructure/messaging/messaging.registry.ts`
- [x] T018: Update `infrastructure.module.ts` — bind `IManeuverRepository → ManeuverRepository`, `ISimulationSftpService → SimulationSftpService`; agregar `Maneuver` a `TypeOrmModule.forFeature` `src/app/infrastructure/infrastructure.module.ts`

---

## Phase 2: User Stories

### US1 + US2: POST /simulations/manual (crear simulación + dispatch SFTP)

- [x] T020 [TEST]: Write failing e2e test — `POST /simulations/manual` happy path: simulación creada con maneuvers, status `MODEL_PROCESSING`, `ISimulationSftpService` mockeado, `IMessageBroker` mockeado, verificar evento publicado `test/modules/manual-simulation/create-manual-simulation.e2e-spec.ts`
- [x] T021 [TEST]: Write failing e2e test — validaciones: 0 maniobras → 400, outputFlowValue negativo → 400, SFTP falla → simulación persiste en `CREATED` y retorna 503 `test/modules/manual-simulation/create-manual-simulation.e2e-spec.ts`
- [x] T022 [P]: Implement request/response DTOs — `CreateManualSimulationRequestDto` (simulationDate, description?, maneuvers[{reservoirCode, outputFlowValue}]), `ManeuverDto`, `ManualSimulationResponseDto`; agregar sección en `simulation.dtos.ts` `src/app/api/dtos/simulation.dtos.ts`
- [x] T023 [P]: Implement `CreateManualSimulationMapper` — `toCommand(dto)`, `toResponseDto(result: ManualSimulationResult)` `src/app/application/mappers/manual-simulation.mappers.ts`
- [x] T024: Implement `CreateManualSimulationCommand` + Handler — (1) crea `Simulation`(MANUAL,CREATED) + `Maneuver[]`, (2) consulta predicciones FORECAST por `reservoirCode` vía `IPredictionRepository`, (3) construye buffer del archivo de entrada, (4) llama `ISimulationSftpService.uploadInputFile`, (5) transiciona simulación → `MODEL_PROCESSING`, (6) publica `simulation.manual.dispatched` vía `IMessageBroker`; si falla SFTP → propaga `ProviderError` (simulación queda CREATED) `src/app/application/commands/manual-simulation.commands.ts`
- [x] T025: Add `POST /simulations/manual` endpoint to `SimulationController` — delega a `CreateManualSimulationMapper.toCommand` → `commandBus.execute` → `toResponseDto`; `EntityError → 400`, `ApiError → statusCode`, `ProviderError → 503`, else `500`; registrar `CreateManualSimulationHandler` en `application.module.ts` `src/app/api/controllers/simulation.controller.ts`

---

### US3: Consume simulation.status.updated → MODEL_FAILED

- [x] T030 [TEST]: Write failing unit test — `SimulationStatusUpdatedConsumer.handle`: simulación existente + payload `{simulationId, status: MODEL_FAILED}` → `simulation.fail()` llamado + persistido; simulationId no encontrado → ack sin crash `test/modules/manual-simulation/simulation-status-updated.consumer.spec.ts`
- [x] T031: Implement `SimulationStatusUpdatedConsumer` — `@EventPattern(Topics.SIMULATION_EVENTS.routingKeys.STATUS_UPDATED)`, llama `simulation.fail()` + `simulationRepository.update`; `ack()` en éxito, `ack()` + log warn si simulationId no existe, `nack(false, false)` solo en error inesperado; registrar en `application.module.ts` controllers `src/app/application/consumers/simulation-status-updated.consumer.ts`

---

### US4: Extend timeseries.ingested → soporte simulationId manual

- [x] T040 [TEST]: Write failing unit test — `ProcessTimeSeriesHandler`: cuando `simulationId` se pasa directamente, la simulación se obtiene por ID (no se busca por fecha), las predicciones quedan ligadas a ese ID `src/app/application/commands/prediction.commands.spec.ts`
- [x] T041: Extend `ProcessTimeSeriesCommand` — agregar campo opcional `simulationId?: string` a `IProcessTimeSeriesCommand`; en el handler, si `simulationId` está presente → `simulationRepository.findById(simulationId)` en lugar de `findByDateAndEnvAndModmeteo`; si no existe → lanzar `ApiError(404)` `src/app/application/commands/prediction.commands.ts`
- [x] T042: Extend `TimeSeriesIngestedConsumer` — agregar `simulationId?: string` al `TimeSeriesIngestedPayload`; pasar `simulationId` a cada `ProcessTimeSeriesCommand` cuando está presente `src/app/application/consumers/timeseries-ingested.consumer.ts`

---

### US5: GET /simulations/manual/:id

- [x] T050 [TEST]: Write failing e2e test — `GET /simulations/manual/:id`: simulación MANUAL existente → 200 con maneuvers; ID inexistente → 404; ID de simulación AUTOMATIC → 404 `test/modules/manual-simulation/get-manual-simulation.e2e-spec.ts`
- [x] T051: Implement `GetManualSimulationByIdQuery` + Handler — obtiene simulación por ID, carga maneuvers, valida que `type === MANUAL`; lanza `ApiError(404)` si no existe o no es MANUAL `src/app/application/queries/manual-simulation.queries.ts`
- [x] T052: Implement `GetManualSimulationByIdMapper` + add `GET /simulations/manual/:id` to controller; agregar `ManualSimulationCacheKeys.byId(id)` al `CACHE_REGISTRY`; invalidar en `CreateManualSimulationHandler` `src/app/application/mappers/manual-simulation.mappers.ts` + `src/app/api/controllers/simulation.controller.ts` + `src/app/infrastructure/cache/cache-config.registry.ts`

---

### US6: GET /simulations/manual

- [x] T060 [TEST]: Write failing e2e test — `GET /simulations/manual`: lista solo simulaciones MANUAL; filtro por `status`; paginación `test/modules/manual-simulation/list-manual-simulations.e2e-spec.ts`
- [x] T061: Implement `ListManualSimulationsQuery` + Handler — filtra `type = MANUAL` + status opcional, pagina; requiere `findAllByType` en `ISimulationRepository` o nuevo método `findManual` `src/app/application/queries/manual-simulation.queries.ts`
- [x] T062: Implement `ListManualSimulationsMapper` + add `GET /simulations/manual` to controller; agregar `ManualSimulationCacheKeys.list(params)` al `CACHE_REGISTRY` `src/app/application/mappers/manual-simulation.mappers.ts` + `src/app/api/controllers/simulation.controller.ts` + `src/app/infrastructure/cache/cache-config.registry.ts`

---

## Phase 3: Integration & Polish

- [x] T070: Add `ManualSimulationCacheKeys` constants to `cache-config.registry.ts` (si no se hizo en T052/T062) + invalidación en `CreateManualSimulationHandler` `src/app/infrastructure/cache/cache-config.registry.ts`
- [x] T071 [P]: Update `CLAUDE.md` — agregar `Maneuver` entity, nuevos topics `SIMULATION_EVENTS`, `SimulationSftpService` a Active Technologies + Recent Changes `CLAUDE.md`
- [x] T072 [P]: Verify `@ApiEndpoint` Swagger decorators en los 3 nuevos endpoints + `@ApiProperty` en todos los DTOs nuevos `src/app/api/`

---

## Dependency Map

| Task | Depends On |
|------|-----------|
| T010 | T001 |
| T011 | T010 |
| T012 | — |
| T013 | — |
| T014 | T010, T012 |
| T015 | T010, T012 |
| T016 | T013 |
| T017 | — |
| T018 | T010, T015, T016, T017 |
| T020 | T018 |
| T021 | T018 |
| T022 | T014 |
| T023 | T022 |
| T024 | T020, T021, T022, T023 |
| T025 | T024 |
| T030 | T018 |
| T031 | T030 |
| T040 | T018 |
| T041 | T040 |
| T042 | T041 |
| T050 | T025 |
| T051 | T050 |
| T052 | T051 |
| T060 | T025 |
| T061 | T060 |
| T062 | T061 |
| T070 | T052, T062 |
| T071 | T025, T031, T042 |
| T072 | T025, T052, T062 |

---

## MVP Scope

Tasks mínimas para feature funcional (P1): **T001 → T042**

Polish diferible si hay time pressure: T070–T072

**Nota OQ-1**: El builder del archivo de entrada en T024 depende del formato que defina el equipo externo. Implementar con formato JSON time-series (igual al de salida) como placeholder hasta confirmación.
