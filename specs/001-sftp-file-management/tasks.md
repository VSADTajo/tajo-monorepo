# Tasks: Hub de Archivos (Storage Local + Cliente SFTP)

**Input**: Design documents from `/specs/001-sftp-file-management/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Tests e2e incluidos. Storage local contra filesystem temporal real. Cliente SFTP con mock de ISftpClientService.

**Organization**: Tasks agrupadas por user story para permitir implementacion y testing independiente de cada historia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos diferentes, sin dependencias)
- **[Story]**: A que user story pertenece (US1-US10)
- Incluye rutas exactas de archivos en las descripciones

---

## Phase 1: Setup (Infraestructura Compartida)

**Purpose**: Inicializacion del proyecto y dependencias

- [X] T001 Install `ssh2-sftp-client` and `@types/ssh2-sftp-client` as dependencies
- [X] T002 Add new environment variables (`STORAGE_BASE_PATH`, `STORAGE_MAX_FILE_SIZE`, `SFTP_CONNECTION_TIMEOUT`, `SFTP_OPERATION_TIMEOUT`) to `.env.example` and `.env`

---

## Phase 2: Foundational (Prerequisitos Bloqueantes)

**Purpose**: Dominio, puertos, configuracion y servicios de infraestructura que DEBEN existir antes de cualquier user story

**⚠️ CRITICAL**: Ningun trabajo de user story puede comenzar hasta que esta fase este completa

- [X] T003 [P] Create `FilePathValueObject` with path traversal validation in `src/app/domain/value-objects/file-path.value-object.ts`
- [X] T004 [P] Create `SftpConnectionValueObject` with connection parameter validation in `src/app/domain/value-objects/sftp-connection.value-object.ts`
- [X] T005 [P] Create local storage result DTOs (`ListFilesResult`, `DownloadFileResult`, `UploadFileResult`, `MoveFileResult`, `DeleteFileResult`) in `src/app/domain/results/`
- [X] T006 [P] Create SFTP result DTOs (`SftpListFilesResult`, `SftpDownloadFileResult`, `SftpDownloadToLocalResult`, `SftpMoveFileResult`, `SftpDeleteFileResult`) in `src/app/domain/results/`
- [X] T007 [P] Create `IFileStorageService` abstract class (port) in `src/app/domain/ports/file-storage-service.port.ts`
- [X] T008 [P] Create `ISftpClientService` abstract class (port) in `src/app/domain/ports/sftp-client-service.port.ts`
- [X] T009 [P] Create storage config module (`storage-config.module.ts`, `storage-config.service.ts`, `storage-config.ts`, `storage-config.type.ts`) in `src/configuration/storage/`
- [X] T010 [P] Create SFTP config module (`sftp-config.module.ts`, `sftp-config.service.ts`, `sftp-config.ts`, `sftp-config.type.ts`) in `src/configuration/sftp/`
- [X] T011 Implement `LocalFileStorageService` with `node:fs/promises` (all 6 methods: listFiles, downloadFile, uploadFile, moveFile, deleteFile, fileExists) in `src/app/infrastructure/services/local-file-storage.service.ts`
- [X] T012 Implement `SftpClientService` with `ssh2-sftp-client` (all 5 methods: listFiles, downloadFile, downloadToLocal, moveFile, deleteFile) in `src/app/infrastructure/services/sftp-client.service.ts`
- [X] T013 Register ports, services, and config modules in `src/app/infrastructure/infrastructure.module.ts` (`IFileStorageService` → `LocalFileStorageService`, `ISftpClientService` → `SftpClientService`, import `StorageConfigModule` and `SftpConfigModule`)

**Checkpoint**: Foundation ready — implementacion de user stories puede comenzar

---

## Phase 3: User Story 1 — Subir Archivo al Storage Local (Priority: P1) 🎯 MVP

**Goal**: Actores externos y servicios internos pueden subir archivos via multipart/form-data especificando una ruta destino

**Independent Test**: Subir un archivo via `POST /files/upload` con multipart y verificar que existe en el storage local

### Implementation for User Story 1

- [X] T014 [P] [US1] Create `UploadFileCommand` + `UploadFileHandler` in `src/app/application/commands/file.commands.ts` (validates path with `FilePathValueObject`, calls `IFileStorageService.uploadFile`, handles overwrite logic)
- [X] T015 [P] [US1] Create upload request/response DTOs (`UploadFileResponseDto`) in `src/app/api/dtos/file.dtos.ts` and `UploadFileMapper` in `src/app/application/mappers/file.mappers.ts`
- [X] T016 [US1] Create `FileController` with `POST /files/upload` endpoint (multer `FileInterceptor`, disk storage, size limit from config) in `src/app/api/controllers/file.controller.ts` and register handler + controller in `src/app/application/application.module.ts`
- [X] T017 [P] [US1] Create file test factory (`buildUploadFileDto`, helper to create temp files) in `test/factories/file.factory.ts`
- [X] T018 [US1] Create upload e2e test (upload success, auto-create dirs, conflict 409, overwrite, path traversal 400) in `test/modules/files/upload-file.e2e-spec.ts`

**Checkpoint**: User Story 1 completa — se pueden subir archivos al storage local

---

## Phase 4: User Story 2 — Listar Archivos del Storage Local (Priority: P2)

**Goal**: Servicios internos pueden listar archivos en un directorio del storage local

**Independent Test**: Listar un directorio con archivos previamente subidos via `GET /files?directory=...` y verificar el listado

### Implementation for User Story 2

- [X] T019 [P] [US2] Create `ListFilesQuery` + `ListFilesHandler` in `src/app/application/queries/file.queries.ts` (validates directory with `FilePathValueObject`, calls `IFileStorageService.listFiles`)
- [X] T020 [P] [US2] Add list response DTOs (`FileInfoDto`, `ListFilesResponseDto`) to `src/app/api/dtos/file.dtos.ts` and `ListFilesMapper` to `src/app/application/mappers/file.mappers.ts`
- [X] T021 [US2] Add `GET /files` list endpoint to `FileController` in `src/app/api/controllers/file.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T022 [US2] Create list e2e test (list with files, empty directory, directory not found 404) in `test/modules/files/list-files.e2e-spec.ts`

**Checkpoint**: User Stories 1 y 2 completas — se pueden subir y listar archivos

---

## Phase 5: User Story 3 — Descargar Archivo del Storage Local (Priority: P3)

**Goal**: Servicios internos pueden descargar un archivo por su ruta como stream binario

**Independent Test**: Descargar un archivo previamente subido via `GET /files/download?path=...` y verificar contenido identico

### Implementation for User Story 3

- [X] T023 [P] [US3] Create `DownloadFileQuery` + `DownloadFileHandler` in `src/app/application/queries/file.queries.ts` (validates path, calls `IFileStorageService.downloadFile`, returns stream)
- [X] T024 [P] [US3] Add download response handling to `src/app/api/dtos/file.dtos.ts` and `DownloadFileMapper` to `src/app/application/mappers/file.mappers.ts`
- [X] T025 [US3] Add `GET /files/download` endpoint to `FileController` (returns `StreamableFile` with `Content-Disposition` and `Content-Length` headers) in `src/app/api/controllers/file.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T026 [US3] Create download e2e test (download success with content verification, file not found 404) in `test/modules/files/download-file.e2e-spec.ts`

**Checkpoint**: User Stories 1-3 completas — flujo completo de subir, listar y descargar

---

## Phase 6: User Story 4 — Mover Archivo en Storage Local (Priority: P4)

**Goal**: Servicios internos pueden mover un archivo de una ruta a otra para organizar archivos post-procesamiento

**Independent Test**: Mover un archivo y verificar que ya no existe en origen y si en destino

### Implementation for User Story 4

- [X] T027 [P] [US4] Create `MoveFileCommand` + `MoveFileHandler` in `src/app/application/commands/file.commands.ts` (validates source and destination paths, calls `IFileStorageService.moveFile`, handles overwrite)
- [X] T028 [P] [US4] Add move request/response DTOs (`MoveFileRequestDto`, `MoveFileResponseDto`) to `src/app/api/dtos/file.dtos.ts` and `MoveFileMapper` to `src/app/application/mappers/file.mappers.ts`
- [X] T029 [US4] Add `POST /files/move` endpoint to `FileController` in `src/app/api/controllers/file.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T030 [US4] Create move e2e test (move success, auto-create dirs, conflict 409, source not found 404) in `test/modules/files/move-file.e2e-spec.ts`

**Checkpoint**: User Stories 1-4 completas — subir, listar, descargar y mover archivos

---

## Phase 7: User Story 5 — Eliminar Archivo del Storage Local (Priority: P5)

**Goal**: Servicios internos pueden eliminar un archivo del storage local

**Independent Test**: Eliminar un archivo y verificar que ya no aparece en el listado

### Implementation for User Story 5

- [X] T031 [P] [US5] Create `DeleteFileCommand` + `DeleteFileHandler` in `src/app/application/commands/file.commands.ts` (validates path, calls `IFileStorageService.deleteFile`)
- [X] T032 [P] [US5] Add delete response DTO (`DeleteFileResponseDto`) to `src/app/api/dtos/file.dtos.ts` and `DeleteFileMapper` to `src/app/application/mappers/file.mappers.ts`
- [X] T033 [US5] Add `DELETE /files` endpoint to `FileController` in `src/app/api/controllers/file.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T034 [US5] Create delete e2e test (delete success, file not found 404) in `test/modules/files/delete-file.e2e-spec.ts`

**Checkpoint**: Modulo 1 (Storage Local) completo — todas las 5 operaciones locales funcionan

---

## Phase 8: User Story 6 — Listar Archivos en Servidor SFTP Externo (Priority: P6)

**Goal**: Servicios internos pueden listar archivos en un directorio de un servidor SFTP externo

**Independent Test**: Conectarse a un servidor SFTP (mock) y listar un directorio, verificando el contenido

### Implementation for User Story 6

- [X] T035 [P] [US6] Create `SftpListFilesQuery` + `SftpListFilesHandler` in `src/app/application/queries/sftp.queries.ts` (validates connection with `SftpConnectionValueObject`, calls `ISftpClientService.listFiles`)
- [X] T036 [P] [US6] Create SFTP connection DTO (`SftpConnectionDto`), list request/response DTOs (`SftpListFilesRequestDto`, `RemoteFileInfoDto`, `SftpListFilesResponseDto`) in `src/app/api/dtos/sftp.dtos.ts` and `SftpListFilesMapper` in `src/app/application/mappers/sftp.mappers.ts`
- [X] T037 [US6] Create `SftpController` with `POST /sftp/list` endpoint in `src/app/api/controllers/sftp.controller.ts` and register handler + controller in `src/app/application/application.module.ts`
- [X] T038 [P] [US6] Create SFTP test factory (`buildSftpConnectionDto`, mock helpers for ISftpClientService) in `test/factories/sftp.factory.ts`
- [X] T039 [US6] Create SFTP list e2e test (list success, invalid credentials 401, directory not found 404) in `test/modules/sftp/sftp-list-files.e2e-spec.ts`

**Checkpoint**: User Story 6 completa — se pueden listar archivos en servidores SFTP externos

---

## Phase 9: User Story 7 — Descargar Archivo desde Servidor SFTP Externo (Priority: P7)

**Goal**: Servicios internos pueden descargar un archivo desde un servidor SFTP externo como stream

**Independent Test**: Descargar un archivo remoto (mock) y verificar que el contenido llega correctamente

### Implementation for User Story 7

- [X] T040 [P] [US7] Create `SftpDownloadFileQuery` + `SftpDownloadFileHandler` in `src/app/application/queries/sftp.queries.ts` (validates connection, calls `ISftpClientService.downloadFile`, returns stream)
- [X] T041 [P] [US7] Add SFTP download request DTO (`SftpDownloadFileRequestDto`) to `src/app/api/dtos/sftp.dtos.ts` and `SftpDownloadFileMapper` to `src/app/application/mappers/sftp.mappers.ts`
- [X] T042 [US7] Add `POST /sftp/download` endpoint to `SftpController` (returns `StreamableFile` with `Content-Disposition` header) in `src/app/api/controllers/sftp.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T043 [US7] Create SFTP download e2e test (download success with content verification, file not found 404) in `test/modules/sftp/sftp-download-file.e2e-spec.ts`

**Checkpoint**: User Stories 6-7 completas — listar y descargar archivos de servidores SFTP

---

## Phase 10: User Story 8 — Descargar de SFTP Externo y Guardar en Storage Local (Priority: P8)

**Goal**: Servicios internos pueden descargar un archivo de SFTP externo y guardarlo directamente en el storage local sin pasos intermedios

**Independent Test**: Ejecutar la transferencia y verificar que el archivo aparece en el storage local

### Implementation for User Story 8

- [X] T044 [P] [US8] Create `SftpDownloadToLocalCommand` + `SftpDownloadToLocalHandler` in `src/app/application/commands/sftp.commands.ts` (validates connection and local path with both value objects, calls `ISftpClientService.downloadToLocal`, handles overwrite)
- [X] T045 [P] [US8] Add download-to-local request/response DTOs (`SftpDownloadToLocalRequestDto`, `SftpDownloadToLocalResponseDto`) to `src/app/api/dtos/sftp.dtos.ts` and `SftpDownloadToLocalMapper` to `src/app/application/mappers/sftp.mappers.ts`
- [X] T046 [US8] Add `POST /sftp/download-to-local` endpoint to `SftpController` in `src/app/api/controllers/sftp.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T047 [US8] Create SFTP download-to-local e2e test (transfer success, conflict 409, remote not found 404) in `test/modules/sftp/sftp-download-to-local.e2e-spec.ts`

**Checkpoint**: User Story 8 completa — transferencia directa SFTP → Storage Local funciona

---

## Phase 11: User Story 9 — Mover Archivo en Servidor SFTP Externo (Priority: P9)

**Goal**: Servicios internos pueden mover un archivo en un servidor SFTP externo para marcar archivos como procesados

**Independent Test**: Mover un archivo remoto (mock) y verificar que ya no esta en origen y si en destino

### Implementation for User Story 9

- [X] T048 [P] [US9] Create `SftpMoveFileCommand` + `SftpMoveFileHandler` in `src/app/application/commands/sftp.commands.ts` (validates connection, calls `ISftpClientService.moveFile`)
- [X] T049 [P] [US9] Add SFTP move request/response DTOs (`SftpMoveFileRequestDto`, `SftpMoveFileResponseDto`) to `src/app/api/dtos/sftp.dtos.ts` and `SftpMoveFileMapper` to `src/app/application/mappers/sftp.mappers.ts`
- [X] T050 [US9] Add `POST /sftp/move` endpoint to `SftpController` in `src/app/api/controllers/sftp.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T051 [US9] Create SFTP move e2e test (move success, source not found 404) in `test/modules/sftp/sftp-move-file.e2e-spec.ts`

**Checkpoint**: User Story 9 completa — mover archivos en servidores SFTP remotos funciona

---

## Phase 12: User Story 10 — Eliminar Archivo en Servidor SFTP Externo (Priority: P10)

**Goal**: Servicios internos pueden eliminar un archivo en un servidor SFTP externo para limpieza post-consumo

**Independent Test**: Eliminar un archivo remoto (mock) y verificar que ya no existe

### Implementation for User Story 10

- [X] T052 [P] [US10] Create `SftpDeleteFileCommand` + `SftpDeleteFileHandler` in `src/app/application/commands/sftp.commands.ts` (validates connection, calls `ISftpClientService.deleteFile`)
- [X] T053 [P] [US10] Add SFTP delete request/response DTOs (`SftpDeleteFileRequestDto`, `SftpDeleteFileResponseDto`) to `src/app/api/dtos/sftp.dtos.ts` and `SftpDeleteFileMapper` to `src/app/application/mappers/sftp.mappers.ts`
- [X] T054 [US10] Add `POST /sftp/delete` endpoint to `SftpController` in `src/app/api/controllers/sftp.controller.ts` and register handler in `src/app/application/application.module.ts`
- [X] T055 [US10] Create SFTP delete e2e test (delete success, path not found 404) in `test/modules/sftp/sftp-delete-file.e2e-spec.ts`

**Checkpoint**: Modulo 2 (Cliente SFTP) completo — todas las 5 operaciones SFTP funcionan

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Validacion final y mejoras que afectan multiples user stories

- [X] T056 Verify project compiles without errors (`npm run build`)
- [X] T057 Run lint and fix any issues (`npm run lint`)
- [X] T058 Run all e2e tests and verify pass (`npm run test:e2e -- --testPathPattern="files|sftp"`)
- [X] T059 Validate quickstart.md scenarios (API examples, env vars, dependency installation)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede iniciar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup — **BLOQUEA** todas las user stories
- **US1-US5 (Phases 3-7)**: Dependen de Phase 2. Se ejecutan secuencialmente (comparten archivos: `file.controller.ts`, `file.dtos.ts`, `file.commands.ts`, `file.queries.ts`, `file.mappers.ts`)
- **US6-US10 (Phases 8-12)**: Dependen de Phase 2. Se ejecutan secuencialmente (comparten archivos: `sftp.controller.ts`, `sftp.dtos.ts`, `sftp.commands.ts`, `sftp.queries.ts`, `sftp.mappers.ts`)
- **US1-US5 y US6-US10 pueden ejecutarse en PARALELO** ya que escriben en archivos completamente diferentes
- **Polish (Phase 13)**: Depende de todas las user stories completadas

### User Story Dependencies

- **US1 (P1)**: Despues de Phase 2. Crea `file.controller.ts`, `file.dtos.ts`, `file.commands.ts`, `file.mappers.ts` — los demas stories locales agregan a estos archivos
- **US2 (P2)**: Despues de US1 (agrega a archivos creados por US1). Crea `file.queries.ts`
- **US3 (P3)**: Despues de US2 (agrega a `file.queries.ts` creado por US2)
- **US4 (P4)**: Despues de US1 (agrega a `file.commands.ts`). Puede ser paralelo a US2-US3 si se coordina acceso a `file.dtos.ts`
- **US5 (P5)**: Despues de US1 (agrega a `file.commands.ts`)
- **US6 (P6)**: Despues de Phase 2. Crea `sftp.controller.ts`, `sftp.dtos.ts`, `sftp.queries.ts`, `sftp.mappers.ts` — **independiente de US1-US5**
- **US7 (P7)**: Despues de US6
- **US8 (P8)**: Despues de US6. Crea `sftp.commands.ts`. Usa `FilePathValueObject` del modulo local
- **US9 (P9)**: Despues de US8 (agrega a `sftp.commands.ts`)
- **US10 (P10)**: Despues de US8 (agrega a `sftp.commands.ts`)

### Within Each User Story

- Command/Query + Handler y DTOs + Mapper pueden crearse en paralelo [P]
- Controller endpoint depende de command/query y DTOs
- E2e test depende de controller endpoint
- Registrar en `application.module.ts` es parte del task de controller

### Parallel Opportunities

- **T003-T010** (Phase 2): Todos los value objects, results, ports y configs son paralelos [P]
- **US1-US5 y US6-US10**: Los dos modulos (local y SFTP) pueden desarrollarse completamente en paralelo
- **Dentro de cada story**: Command/Query [P] y DTOs+Mapper [P] son paralelos
- **Tests factories**: T017 [P] y T038 [P] son paralelos a las implementaciones de sus stories

---

## Parallel Example: Modulos Local y SFTP

```bash
# Despues de Phase 2 (Foundational), ambos modulos pueden iniciar en paralelo:

# Developer A: Modulo Local
Task T014: UploadFile command + handler
Task T015: Upload DTOs + mapper
Task T016: FileController + upload endpoint
# ... continua con US2-US5

# Developer B: Modulo SFTP (en paralelo)
Task T035: SftpListFiles query + handler
Task T036: SFTP DTOs + mapper
Task T037: SftpController + list endpoint
# ... continua con US7-US10
```

## Parallel Example: Dentro de User Story 1

```bash
# Estas tareas pueden lanzarse en paralelo (archivos diferentes):
Task T014: [P] [US1] UploadFile command + handler in file.commands.ts
Task T015: [P] [US1] Upload DTOs + mapper in file.dtos.ts + file.mappers.ts
Task T017: [P] [US1] File test factory in test/factories/file.factory.ts

# Luego, secuencialmente:
Task T016: [US1] FileController + upload endpoint (depende de T014, T015)
Task T018: [US1] Upload e2e test (depende de T016)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — bloquea todas las stories)
3. Complete Phase 3: User Story 1 (Upload)
4. **STOP and VALIDATE**: Subir un archivo y verificar que existe en el filesystem
5. Deploy/demo si esta listo

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Upload) → Test → **MVP!** (se pueden recibir archivos)
3. US2 (List) + US3 (Download) → Test → Flujo basico completo (subir, listar, descargar)
4. US4 (Move) + US5 (Delete) → Test → **Modulo Local completo**
5. US6 (SFTP List) + US7 (SFTP Download) → Test → Lectura de SFTP externos
6. US8 (SFTP to Local) → Test → Transferencia directa
7. US9 (SFTP Move) + US10 (SFTP Delete) → Test → **Modulo SFTP completo**

### Parallel Team Strategy

Con dos developers:

1. Equipo completa Setup + Foundational juntos
2. Una vez Foundational listo:
   - **Developer A**: US1 → US2 → US3 → US4 → US5 (Modulo Local)
   - **Developer B**: US6 → US7 → US8 → US9 → US10 (Modulo SFTP)
3. Stories se completan e integran independientemente
4. Polish al final cuando ambos modulos estan listos

---

## Notes

- [P] tasks = archivos diferentes, sin dependencias
- [Story] label mapea tarea a user story especifica para trazabilidad
- Cada user story debe ser completable y testeable independientemente
- Commit despues de cada tarea o grupo logico
- Detenerse en cualquier checkpoint para validar la story independientemente
- Los dos modulos (Local y SFTP) son independientes y pueden desarrollarse en paralelo
- Evitar: tareas vagas, conflictos en mismo archivo, dependencias cross-story que rompan independencia
