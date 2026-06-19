# Tasks: Manual Simulation Flow — ms-model-api

**Spec**: ms-model-api/.specify/specs/manual-simulation-flow/spec.md
**Plan**: ms-model-api/.specify/specs/manual-simulation-flow/plan.md
**Created**: 2026-06-19

---

## Phase 0: Setup

- [x] T001: Create migration `add-simulation-runs-table` — tabla `simulation_runs` con `simulationId` (uuid, UNIQUE), `outputFolder`, `status`, `startedAt`, `completedAt`, `errorMessage`, índice en `status` `src/migrations/1750000100000-add-simulation-runs-table.ts`
- [x] T002: Add `SIMULATION_POLL_INTERVAL_MINUTES` to `.env.example` (default `5`) `src/configuration/app/` + `.env.example`

---

## Phase 1: Foundational

> Capa domain + infrastructure completa antes de escribir los primeros tests.

- [x] T010: Implement `SimulationRunStatus` enum — `WAITING_RESULT | COMPLETED | FAILED` `src/app/domain/types/simulation-run-status.enum.ts`
- [x] T011 [P]: Implement `SimulationRun` entity — `simulationId` (unique), `outputFolder`, `status`, `startedAt`, `completedAt`, `errorMessage`; métodos de negocio `complete()` y `fail(error: string)`; `validate()` `src/app/domain/entities/simulation-run.entity.ts`
- [x] T012 [P]: Implement `ISimulationRunRepository` abstract port — `create(run: SimulationRun): Promise<SimulationRun>`, `findBySimulationId(id: string): Promise<SimulationRun | null>`, `findWaitingResult(): Promise<SimulationRun[]>`, `update(run: SimulationRun): Promise<SimulationRun>` `src/app/domain/ports/simulation-run-repository.port.ts`
- [x] T013 [P]: Extend `IMessageBroker` abstract port — agregar `subscribeToTopic<T>(exchange: string, routingKey: string, queue: string, handler: MessageHandler<T>): Promise<void>`; definir tipo `MessageHandler<T>` `src/app/domain/ports/message-broker.port.ts`
- [x] T014 [P]: Implement `SimulationRunResult` — wraps `SimulationRun` fields `src/app/domain/results/simulation-run.result.ts`
- [x] T015: Implement `SimulationRunRepository` — `create`, `findBySimulationId`, `findWaitingResult` (WHERE status = WAITING_RESULT), `update`; registrar `SimulationRun` en `TypeOrmModule.forFeature` `src/app/infrastructure/persistence/simulation-run.repository.ts`
- [x] T016: Extend `RabbitmqService` — implementar `subscribeToTopic()` usando `channel.assertExchange + assertQueue + bindQueue + consume`; `ack/nack` delegados al handler; reconecta si el canal no está disponible `src/app/infrastructure/messaging/rabbitmq.service.ts`
- [x] T017 [P]: Update `messaging.registry.ts` — agregar constante `MODEL_SIMULATION_DISPATCHED_QUEUE = 'model-simulation-dispatched'`; agregar `SIMULATION_EVENTS` exchange con routing keys `MANUAL_DISPATCHED` y `STATUS_UPDATED` para consumo `src/app/infrastructure/messaging/messaging.registry.ts`
- [x] T018: Implement `SimulationResultFetcherService` — llama ms-sftp-api (`GET /files`, `GET /files/download`, `POST /files/move`) vía axios; contiene la misma lógica de parseo JSON time-series que `SftpFileProviderService.mapResponseToNormalized`; retorna `NormalizedTimeSeriesResult[] | null` (null = carpeta vacía); en parse error mueve a `corrupted/` y lanza `ProviderError` `src/app/infrastructure/services/simulation-result-fetcher.service.ts`
- [x] T019: Update `infrastructure.module.ts` — registrar `SimulationRun` en `TypeOrmModule.forFeature`, bind `ISimulationRunRepository → SimulationRunRepository`, agregar `SimulationResultFetcherService` a providers/exports `src/app/infrastructure/infrastructure.module.ts`

---

## Phase 2: User Stories

### US1: Register SimulationRun on dispatch event

- [x] T020 [TEST]: Write failing unit test — `RegisterSimulationRunHandler`: payload válido → crea `SimulationRun` en `WAITING_RESULT`; simulationId duplicado → skip (findBySimulationId retorna existente, no llama create) `src/app/application/commands/simulation-run.commands.spec.ts`
- [x] T021: Implement `RegisterSimulationRunCommand` + Handler — recibe `{ simulationId, outputFolder }`, verifica idempotencia vía `findBySimulationId`, crea entidad con `status = WAITING_RESULT` y `startedAt = new Date()`; registrar en `application.module.ts` `src/app/application/commands/simulation-run.commands.ts`
- [x] T022 [TEST]: Write failing unit test — `SimulationDispatchedConsumerService.onModuleInit`: llama `messageBroker.subscribeToTopic` con el exchange/routing key/queue correctos; handler ejecuta `RegisterSimulationRunCommand` con el payload del evento `src/app/infrastructure/services/simulation-dispatched-consumer.service.spec.ts`
- [x] T023: Implement `SimulationDispatchedConsumerService` — `OnModuleInit`; llama `messageBroker.subscribeToTopic(SIMULATION_EVENTS.exchange, MANUAL_DISPATCHED, MODEL_SIMULATION_DISPATCHED_QUEUE, handler)`; handler ejecuta `commandBus.execute(new RegisterSimulationRunCommand(payload))`; `ack()` en éxito, `nack(false)` en error; registrar en `infrastructure.module.ts` providers `src/app/infrastructure/services/simulation-dispatched-consumer.service.ts`

---

### US2: Poll SFTP output folder and process result file

- [x] T030 [TEST]: Write failing unit test — `SimulationRunPollerService.pollOnce()`: (a) sin archivos → ningún update ni publish; (b) archivo válido → publica `timeseries.ingested` con `simulationId`, run → COMPLETED; (c) archivo malformado → run → FAILED, publica `simulation.status.updated` con `MODEL_FAILED`; mock de `ISimulationRunRepository`, `SimulationResultFetcherService`, `IMessageBroker` `src/app/infrastructure/services/simulation-run-poller.service.spec.ts`
- [x] T031: Implement `SimulationRunPollerService` — `OnModuleInit`; registra `setInterval` con `SIMULATION_POLL_INTERVAL_MINUTES * 60_000`; `pollOnce()` consulta `findWaitingResult()` y llama `processSingleRun(run)` por cada pendiente; en éxito publica `timeseries.ingested` (con `simulationId`) → `run.complete()` → `update`; en `ProviderError` publica `simulation.status.updated { MODEL_FAILED }` → `run.fail(error)` → `update`; registrar en `infrastructure.module.ts` providers `src/app/infrastructure/services/simulation-run-poller.service.ts`

---

## Phase 3: Integration & Polish

- [x] T040: Write e2e test — crea `SimulationRun` directamente via `RegisterSimulationRunCommand` con DB real (Testcontainer); verifica que `findBySimulationId` retorna el registro; verifica idempotencia (segunda llamada no crea duplicado) `test/modules/simulation-run/register-simulation-run.e2e-spec.ts`
- [x] T041 [P]: Update `CLAUDE.md` — agregar `SimulationRun` entity, `SIMULATION_EVENTS` consume, `SimulationResultFetcherService`, `SimulationRunPollerService` a Active Technologies + Recent Changes `CLAUDE.md`
- [x] T042 [P]: Run `npm run build` para verificar compilación sin errores; verificar que no se introdujeron cambios en el flujo automático existente `—`

---

## Dependency Map

| Task | Depends On |
|------|-----------|
| T010 | T001 |
| T011 | T010 |
| T012 | T010 |
| T013 | — |
| T014 | T010, T011 |
| T015 | T011, T012 |
| T016 | T013 |
| T017 | — |
| T018 | — |
| T019 | T015, T016, T018 |
| T020 | T019 |
| T021 | T020 |
| T022 | T019 |
| T023 | T021, T022 |
| T030 | T019, T018 |
| T031 | T030, T023 |
| T040 | T021 |
| T041 | T031 |
| T042 | T031 |

---

## MVP Scope

Tasks mínimas para feature funcional (P1): **T001 → T031**

Polish diferible: T040–T042

**Nota**: `SimulationResultFetcherService` (T018) replica la lógica de parseo de `SftpFileProviderService.mapResponseToNormalized` sin modificar el flujo automático existente. Si el equipo prefiere refactorizar en el futuro para compartir el parser, es un cambio interno a ms-model-api sin impacto en la API.
