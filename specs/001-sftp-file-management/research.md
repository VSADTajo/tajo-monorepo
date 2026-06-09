# Investigacion: Hub de Archivos (Storage Local + Cliente SFTP)

**Feature**: 001-sftp-file-management
**Fecha**: 2026-03-04

## R1: Enfoque de Storage Local

**Decision**: Filesystem local con `node:fs/promises` nativo

**Razon**:
- No se necesita libreria externa — Node.js tiene soporte completo de filesystem
- `fs/promises` provee API async/await nativa
- `fs.createReadStream` / `fs.createWriteStream` para streaming de archivos grandes
- Ruta base configurable via `STORAGE_BASE_PATH`
- Actores externos y servicios internos suben/descargan archivos via REST

**Alternativas evaluadas**:
- S3/MinIO (fuera de alcance — solo filesystem local en esta version)
- `fs-extra` (agrega utilidades, pero `node:fs/promises` + `node:path` son suficientes)

## R2: Cliente SFTP para Servidores Externos

**Decision**: `ssh2-sftp-client` v12.x como cliente SFTP

**Razon**:
- Libreria madura y mantenida (2M+ descargas/semana, actualizada activamente)
- API basada en Promises, compatible con async/await
- Soporta autenticacion por password y SSH key (privateKey)
- Streaming nativo para descargas grandes (`get()` con `ReadableStream`)
- Timeouts configurables (conexion y operacion)
- Compatible con SFTP protocolo version 2+

**Alternativas evaluadas**:
- `ssh2` directo (mas bajo nivel, requiere manejar protocolo SFTP manualmente)
- `node-sftp` (menos mantenido, comunidad mas pequeña)
- FTP clasico (inseguro — solo SFTP en alcance)

## R3: Seguridad — Path Traversal (Storage Local)

**Decision**: Sanitizacion de rutas con `path.resolve` + validacion contra `STORAGE_BASE_PATH`

**Razon**:
- CRITICO: los consumidores envian rutas libres en el request
- Se debe prevenir acceso fuera de `STORAGE_BASE_PATH` (ej: `../../etc/passwd`)
- Algoritmo: `path.resolve(STORAGE_BASE_PATH, userPath)` y verificar que el resultado comience con `STORAGE_BASE_PATH`
- Se implementa como Value Object `FilePathValueObject` que valida y normaliza
- Cualquier ruta que intente escapar lanza `EntityError` → 400

**Alternativas evaluadas**:
- Regex para filtrar `../` (insuficiente — hay multiples formas de path traversal)
- Chroot/jail (nivel de OS, no de aplicacion — overkill)

## R4: Manejo de Archivos Grandes (Streaming)

**Decision**: Streaming via Node.js streams nativos + ssh2-sftp-client streams

**Razon**:
- **Storage Local**:
  - Descarga: `fs.createReadStream(path)` → NestJS `StreamableFile` → response stream
  - Subida: `multer` recibe el archivo via multipart y lo guarda en disco directamente (disk storage)
- **Cliente SFTP**:
  - Descarga: `sftp.get(remotePath)` retorna `ReadableStream` → se puede enviar directo como response o guardar en storage local via pipe
  - Transferencia directa SFTP→Local: se conecta el stream de descarga directamente al filesystem local sin buffering intermedio
- No se carga el archivo completo en memoria en ningun caso
- Soporta archivos hasta 500 MB sin problemas

**Alternativas evaluadas**:
- Buffering completo en memoria (no viable para 500 MB)
- Descarga SFTP a temp + copia a destino (doble escritura innecesaria — mejor streaming directo)

## R5: Diseno de Endpoints REST

**Decision**: Dos controllers separados — `/files/*` (local) y `/sftp/*` (cliente SFTP externo)

**Razon**:
- Separacion clara de responsabilidades: operaciones locales vs operaciones remotas
- Las operaciones SFTP requieren credenciales por request (host, port, username, password/privateKey)
- Las operaciones locales no requieren credenciales

**Endpoints Storage Local** (`/files/*`):
- `POST /files/upload` — Subir archivo (multipart/form-data con path + file)
- `GET /files` — Listar archivos en directorio (query param: directory)
- `GET /files/download` — Descargar archivo (query param: path, retorna stream)
- `POST /files/move` — Mover archivo (JSON body)
- `DELETE /files` — Eliminar archivo (query param: path)

**Endpoints Cliente SFTP** (`/sftp/*`):
- `GET /sftp/list` — Listar archivos en servidor remoto (query param: directory + credenciales en body/headers)
- `GET /sftp/download` — Descargar archivo de servidor remoto (retorna stream)
- `POST /sftp/download-to-local` — Descargar de SFTP y guardar en storage local
- `POST /sftp/move` — Mover archivo en servidor remoto
- `DELETE /sftp` — Eliminar archivo en servidor remoto

## R6: Manejo de Errores

**Decision**: Mapear errores de filesystem y SFTP a la jerarquia del boilerplate

**Razon**:
- **Storage Local**:
  - `ENOENT` → `ApiError(404, 'Archivo no encontrado')`
  - `EEXIST` → `ApiError(409, 'Archivo ya existe')`
  - `EACCES` → `ApiError(403, 'Permiso denegado')`
  - `ENOSPC` → `ApiError(500, 'Disco lleno')`
  - Path traversal → `EntityError('Ruta invalida')` → 400
- **Cliente SFTP**:
  - Autenticacion fallida → `ApiError(401, 'Credenciales SFTP invalidas')`
  - Archivo/directorio no encontrado → `ApiError(404, '...')`
  - Permiso denegado en servidor → `ApiError(403, '...')`
  - Timeout de conexion/operacion → `ProviderError('...')` → 500
  - Conexion perdida a mitad de transferencia → `ProviderError('...')` → 500, limpiar archivos parciales
- **Seguridad**: Las credenciales SFTP NUNCA se loggean (ni en errores ni en logs)

## R7: Creacion Automatica de Directorios

**Decision**: Crear directorios intermedios automaticamente con `fs.mkdir(path, { recursive: true })`

**Razon**:
- El consumidor no deberia tener que crear directorios manualmente antes de subir
- `mkdir` con `recursive: true` es seguro y no lanza error si ya existe
- Se aplica en upload, move, y download-to-local

## R8: Upload via Multer

**Decision**: Usar `@nestjs/platform-express` con multer disk storage

**Razon**:
- Multer ya viene incluido en NestJS (no se necesita instalar nada extra)
- `diskStorage` guarda directamente en una carpeta temporal
- Despues del upload a temp, se mueve el archivo a la ruta destino final
- Se configura limite de tamano via `STORAGE_MAX_FILE_SIZE` (default: 500 MB)

## R9: Manejo de Conexiones SFTP

**Decision**: Conexion por operacion — abrir, ejecutar, cerrar

**Razon**:
- Las credenciales se proporcionan por solicitud (no se persisten)
- Cada operacion SFTP abre una conexion nueva, ejecuta la operacion y cierra
- No hay connection pooling — cada request es independiente
- Timeouts configurables: conexion (default 10s) y operacion (default 60s)
- Si la conexion se pierde a mitad de operacion, se limpia cualquier archivo parcial

**Alternativas evaluadas**:
- Connection pooling (requiere persistir credenciales — fuera de alcance)
- Keep-alive con reconexion (complejidad innecesaria para el patron request/response)

## R10: Testing

**Decision**: Tests e2e reales contra filesystem temporal + mock de SFTP

**Razon**:
- **Storage Local**: No se mockea el filesystem — se usa un directorio temporal real en cada test
  - `beforeAll`: crear directorio temporal con `fs.mkdtemp`
  - `afterEach`: limpiar archivos del directorio temporal
  - `afterAll`: eliminar directorio temporal
- **Cliente SFTP**: Se mockea `ISftpClientService` (el servicio SFTP externo SI es servicio externo)
  - Mock retorna datos simulados para list, download, move, delete
  - Consistente con el principio V: "Mock solo servicios externos"
- Se prueba el flujo completo: HTTP → Controller → Bus → Handler → Service → filesystem/mock
