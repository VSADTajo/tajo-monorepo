# Plan de Implementacion: Hub de Archivos (Storage Local + Cliente SFTP)

**Branch**: `001-sftp-file-management` | **Fecha**: 2026-03-04 | **Spec**: [spec.md](./spec.md)
**Input**: Especificacion de feature desde `/specs/001-sftp-file-management/spec.md`

## Resumen

Agregar un hub central de archivos a la API existente con dos capacidades: (1) **Storage Local** para que actores externos y servicios internos suban, descarguen, listen, muevan y eliminen archivos via REST, almacenados en el filesystem local bajo `STORAGE_BASE_PATH`; (2) **Cliente SFTP** para conectarse a servidores SFTP externos y leer, descargar, mover y eliminar archivos remotos. El storage local usa `node:fs/promises` nativo. El cliente SFTP usa `ssh2-sftp-client`. Ambos modulos siguen la arquitectura hexagonal del boilerplate con puertos abstractos. No se requiere base de datos.

## Contexto Tecnico

**Lenguaje/Version**: TypeScript 5.7+ (strict mode) en Node.js >= 22
**Dependencias Principales**: NestJS 11, @nestjs/cqrs 11, multer (incluido en NestJS), `ssh2-sftp-client` (nueva).
**Almacenamiento**: Filesystem local (`STORAGE_BASE_PATH`). Sin base de datos para esta feature.
**Testing**: Jest + Supertest. Tests e2e: storage local contra filesystem temporal real, cliente SFTP con mock de `ISftpClientService`.
**Plataforma Objetivo**: Servidor Linux (Docker)
**Tipo de Proyecto**: Web API (backend NestJS existente)
**Metas de Rendimiento**: Archivos hasta 500 MB via streaming; 10 operaciones concurrentes
**Restricciones**: Streaming obligatorio para archivos grandes; sanitizacion de rutas contra path traversal; credenciales SFTP por request (nunca persistidas ni loggeadas)
**Escala/Alcance**: Archivos individuales, rutas libres, sin autenticacion en esta version

## Constitution Check

*GATE: Debe pasar antes de la investigacion Phase 0. Re-verificar despues del diseno Phase 1.*

### Evaluacion Pre-Diseno

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Arquitectura Hexagonal | PASA | api/ -> application/ -> domain/ <- infrastructure/. Storage local en infrastructure/services/. Cliente SFTP en infrastructure/services/. |
| II. CQRS con Patron MediatR | PASA | Upload/Move/Delete son Commands. List/Download son Queries. SFTP Download-to-local es Command. Controllers usan CommandBus/QueryBus. |
| III. Inversion de Dependencia via Puertos | PASA | `IFileStorageService` y `ISftpClientService` como clases abstractas en domain/ports/. Implementadas en infrastructure/services/. |
| IV. Validacion Domain-Driven | PASA | `FilePathValueObject` valida rutas locales. `SftpConnectionValueObject` valida credenciales SFTP. |
| V. Testing de Integracion via Endpoints | PASA | Tests e2e: filesystem local real (NO es servicio externo). SFTP client mockeado (SI es servicio externo). |
| VI. Type Safety & Strictness | PASA | Todo el codigo con `strict: true`. Path aliases. Sin `any`. |
| VII. Jerarquia de Errores Estructurada | PASA | Errores de filesystem → ApiError/EntityError. Errores SFTP → ApiError/ProviderError. Controllers usan patron try/catch estandar. |

### Evaluacion Post-Diseno

Todos los principios pasan sin violaciones.

## Estructura del Proyecto

### Documentacion (esta feature)

```text
specs/001-sftp-file-management/
├── plan.md              # Este archivo
├── research.md          # Phase 0: investigacion
├── data-model.md        # Phase 1: modelo de datos
├── quickstart.md        # Phase 1: guia rapida
├── contracts/           # Phase 1: contratos API
│   └── openapi.yaml
└── tasks.md             # Phase 2: tareas (/speckit.tasks)
```

### Codigo Fuente (raiz del repositorio)

```text
src/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── file.controller.ts             # Endpoints REST storage local (/files/*)
│   │   │   └── sftp.controller.ts             # Endpoints REST cliente SFTP (/sftp/*)
│   │   └── dtos/
│   │       ├── file.dtos.ts                   # Request/Response DTOs storage local
│   │       └── sftp.dtos.ts                   # Request/Response DTOs cliente SFTP
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   ├── file.commands.ts               # UploadFile, MoveFile, DeleteFile
│   │   │   └── sftp.commands.ts               # SftpDownloadToLocal, SftpMoveFile, SftpDeleteFile
│   │   ├── queries/
│   │   │   ├── file.queries.ts                # ListFiles, DownloadFile
│   │   │   └── sftp.queries.ts                # SftpListFiles, SftpDownloadFile
│   │   └── mappers/
│   │       ├── file.mappers.ts                # DTO <-> Command/Result transformaciones locales
│   │       └── sftp.mappers.ts                # DTO <-> Command/Result transformaciones SFTP
│   │
│   ├── domain/
│   │   ├── ports/
│   │   │   ├── file-storage-service.port.ts   # IFileStorageService (storage local)
│   │   │   └── sftp-client-service.port.ts    # ISftpClientService (cliente SFTP)
│   │   ├── results/
│   │   │   ├── list-files.result.ts
│   │   │   ├── download-file.result.ts
│   │   │   ├── upload-file.result.ts
│   │   │   ├── move-file.result.ts
│   │   │   ├── delete-file.result.ts
│   │   │   ├── sftp-list-files.result.ts
│   │   │   ├── sftp-download-file.result.ts
│   │   │   ├── sftp-download-to-local.result.ts
│   │   │   ├── sftp-move-file.result.ts
│   │   │   └── sftp-delete-file.result.ts
│   │   └── value-objects/
│   │       ├── file-path.value-object.ts      # Validacion y sanitizacion de rutas locales
│   │       └── sftp-connection.value-object.ts # Validacion de conexion SFTP
│   │
│   └── infrastructure/
│       └── services/
│           ├── local-file-storage.service.ts   # Implementacion con node:fs/promises
│           └── sftp-client.service.ts          # Implementacion con ssh2-sftp-client
│
└── configuration/
    ├── storage/
    │   ├── storage-config.module.ts
    │   ├── storage-config.service.ts
    │   ├── storage-config.ts
    │   └── storage-config.type.ts
    └── sftp/
        ├── sftp-config.module.ts
        ├── sftp-config.service.ts
        ├── sftp-config.ts
        └── sftp-config.type.ts

test/
├── factories/
│   ├── file.factory.ts
│   └── sftp.factory.ts
└── modules/
    ├── files/
    │   ├── upload-file.e2e-spec.ts
    │   ├── list-files.e2e-spec.ts
    │   ├── download-file.e2e-spec.ts
    │   ├── move-file.e2e-spec.ts
    │   └── delete-file.e2e-spec.ts
    └── sftp/
        ├── sftp-list-files.e2e-spec.ts
        ├── sftp-download-file.e2e-spec.ts
        ├── sftp-download-to-local.e2e-spec.ts
        ├── sftp-move-file.e2e-spec.ts
        └── sftp-delete-file.e2e-spec.ts
```

**Decision de Estructura**: Se sigue la arquitectura hexagonal del boilerplate. Dos modulos separados (storage local y cliente SFTP) con sus propios controllers, commands/queries, DTOs y puertos. Sin base de datos ni migraciones. Una dependencia nueva: `ssh2-sftp-client` para el cliente SFTP.

## Complexity Tracking

No se requieren violaciones a la constitucion. Todos los principios se cumplen directamente.
