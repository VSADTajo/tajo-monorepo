# Guia Rapida: Hub de Archivos (Storage Local + Cliente SFTP)

**Feature**: 001-sftp-file-management
**Fecha**: 2026-03-04

## Prerequisitos

- Node.js >= 22 (ver `.nvmrc`)
- npm instalado
- Docker (para tests e2e)

## Instalacion de Dependencias

```bash
npm install ssh2-sftp-client
npm install -D @types/ssh2-sftp-client
```

**Nota**: `node:fs/promises` y `multer` ya estan incluidos — no requieren instalacion.

## Variables de Entorno (nuevas)

```env
# Ruta base del storage de archivos (OBLIGATORIA)
STORAGE_BASE_PATH=/data/files

# Tamano maximo de archivo en bytes (default: 500 MB)
STORAGE_MAX_FILE_SIZE=524288000

# Timeout de conexion SFTP en ms (default: 10000)
SFTP_CONNECTION_TIMEOUT=10000

# Timeout de operacion SFTP en ms (default: 60000)
SFTP_OPERATION_TIMEOUT=60000
```

## Orden de Implementacion

### Paso 1: Dominio (sin dependencias externas)

1. Value Object: `src/app/domain/value-objects/file-path.value-object.ts`
2. Value Object: `src/app/domain/value-objects/sftp-connection.value-object.ts`
3. Puerto Local: `src/app/domain/ports/file-storage-service.port.ts`
4. Puerto SFTP: `src/app/domain/ports/sftp-client-service.port.ts`
5. Results Locales: `src/app/domain/results/` (list-files, download-file, upload-file, move-file, delete-file)
6. Results SFTP: `src/app/domain/results/` (sftp-list-files, sftp-download-file, sftp-download-to-local, sftp-move-file, sftp-delete-file)

### Paso 2: Infraestructura (implementacion de puertos)

7. Configuracion Storage: `src/configuration/storage/` (modulo, servicio, config, tipo)
8. Configuracion SFTP: `src/configuration/sftp/` (modulo, servicio, config, tipo)
9. Servicio Storage Local: `src/app/infrastructure/services/local-file-storage.service.ts`
10. Servicio SFTP Client: `src/app/infrastructure/services/sftp-client.service.ts`
11. Registrar en `infrastructure.module.ts`:
    - `{ provide: IFileStorageService, useClass: LocalFileStorageService }`
    - `{ provide: ISftpClientService, useClass: SftpClientService }`
    - Importar `StorageConfigModule` y `SftpConfigModule`

### Paso 3: Aplicacion (commands, queries, mappers)

12. Queries Locales: `src/app/application/queries/file.queries.ts` (ListFiles, DownloadFile)
13. Commands Locales: `src/app/application/commands/file.commands.ts` (UploadFile, MoveFile, DeleteFile)
14. Queries SFTP: `src/app/application/queries/sftp.queries.ts` (SftpListFiles, SftpDownloadFile)
15. Commands SFTP: `src/app/application/commands/sftp.commands.ts` (SftpDownloadToLocal, SftpMoveFile, SftpDeleteFile)
16. Mappers: `src/app/application/mappers/file.mappers.ts` y `sftp.mappers.ts`

### Paso 4: API (controllers y DTOs)

17. DTOs Locales: `src/app/api/dtos/file.dtos.ts`
18. DTOs SFTP: `src/app/api/dtos/sftp.dtos.ts`
19. Controller Local: `src/app/api/controllers/file.controller.ts`
20. Controller SFTP: `src/app/api/controllers/sftp.controller.ts`
21. Registrar en `application.module.ts`:
    - Handlers en providers
    - Controllers en controllers

### Paso 5: Tests

22. Factory: `test/factories/file.factory.ts`
23. Factory SFTP: `test/factories/sftp.factory.ts`
24. Tests e2e Locales: `test/modules/files/` (5 archivos de test)
25. Tests e2e SFTP: `test/modules/sftp/` (5 archivos de test)

## Verificacion

```bash
# Compilar sin errores
npm run build

# Lint
npm run lint

# Tests e2e (storage local — sin mocks de filesystem)
npm run test:e2e -- --testPathPattern=files

# Tests e2e (cliente SFTP — con mock de ISftpClientService)
npm run test:e2e -- --testPathPattern=sftp
```

## Referencia Rapida de API

### Storage Local (`/files/*`)

| Operacion | Metodo | Endpoint | Parametros |
|-----------|--------|----------|------------|
| Subir archivo | POST | `/files/upload` | multipart: `path` + `file` + `overwrite?` |
| Listar archivos | GET | `/files?directory=...` | query: `directory` |
| Descargar archivo | GET | `/files/download?path=...` | query: `path` |
| Mover archivo | POST | `/files/move` | JSON: `{ sourcePath, destinationPath, overwrite? }` |
| Eliminar archivo | DELETE | `/files?path=...` | query: `path` |

### Cliente SFTP (`/sftp/*`)

| Operacion | Metodo | Endpoint | Parametros |
|-----------|--------|----------|------------|
| Listar archivos | POST | `/sftp/list` | JSON: `{ connection, directory }` |
| Descargar archivo | POST | `/sftp/download` | JSON: `{ connection, path }` |
| Descargar a local | POST | `/sftp/download-to-local` | JSON: `{ connection, remotePath, localPath, overwrite? }` |
| Mover archivo | POST | `/sftp/move` | JSON: `{ connection, sourcePath, destinationPath }` |
| Eliminar archivo | POST | `/sftp/delete` | JSON: `{ connection, path }` |

**Nota**: Los endpoints SFTP usan POST porque requieren un body con credenciales de conexion. Las credenciales nunca se envian como query params.

## Ejemplo de Uso

### Storage Local

```bash
# Subir un archivo
curl -X POST http://localhost:3000/files/upload \
  -F "path=inbox/partner-a/report.csv" \
  -F "file=@./report.csv"

# Listar archivos
curl http://localhost:3000/files?directory=inbox/partner-a

# Descargar archivo
curl -O http://localhost:3000/files/download?path=inbox/partner-a/report.csv

# Mover archivo
curl -X POST http://localhost:3000/files/move \
  -H "Content-Type: application/json" \
  -d '{"sourcePath":"inbox/partner-a/report.csv","destinationPath":"processed/partner-a/report.csv"}'

# Eliminar archivo
curl -X DELETE "http://localhost:3000/files?path=processed/partner-a/report.csv"
```

### Cliente SFTP

```bash
# Listar archivos en servidor remoto
curl -X POST http://localhost:3000/sftp/list \
  -H "Content-Type: application/json" \
  -d '{"connection":{"host":"sftp.example.com","port":22,"username":"user","password":"pass"},"directory":"/data/incoming"}'

# Descargar archivo remoto como stream
curl -X POST http://localhost:3000/sftp/download \
  -H "Content-Type: application/json" \
  -d '{"connection":{"host":"sftp.example.com","port":22,"username":"user","password":"pass"},"path":"/data/incoming/report.csv"}' \
  -o report.csv

# Descargar de SFTP y guardar en storage local
curl -X POST http://localhost:3000/sftp/download-to-local \
  -H "Content-Type: application/json" \
  -d '{"connection":{"host":"sftp.example.com","port":22,"username":"user","password":"pass"},"remotePath":"/data/incoming/report.csv","localPath":"inbox/external/report.csv"}'

# Mover archivo en servidor remoto
curl -X POST http://localhost:3000/sftp/move \
  -H "Content-Type: application/json" \
  -d '{"connection":{"host":"sftp.example.com","port":22,"username":"user","password":"pass"},"sourcePath":"/data/incoming/report.csv","destinationPath":"/data/processed/report.csv"}'

# Eliminar archivo en servidor remoto
curl -X POST http://localhost:3000/sftp/delete \
  -H "Content-Type: application/json" \
  -d '{"connection":{"host":"sftp.example.com","port":22,"username":"user","password":"pass"},"path":"/data/processed/old-report.csv"}'
```

## Notas Importantes

- **Una dependencia nueva**: `ssh2-sftp-client` (para cliente SFTP externo)
- **Sin base de datos** — no se requieren migraciones
- **`STORAGE_BASE_PATH` es obligatoria** — la API no arranca sin esta variable
- **Seguridad**: todas las rutas locales se sanitizan contra path traversal
- **Credenciales SFTP**: se proporcionan por request, NUNCA se persisten ni se loggean
- **Streaming** para archivos grandes — descarga retorna `StreamableFile`, subida usa multer disk storage, SFTP usa streams nativos
- **Directorios se crean automaticamente** al subir o mover archivos locales
- **Conexiones SFTP** se abren y cierran por operacion (sin pooling)
