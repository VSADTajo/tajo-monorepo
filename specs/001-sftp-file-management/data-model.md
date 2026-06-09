# Modelo de Datos: Hub de Archivos (Storage Local + Cliente SFTP)

**Feature**: 001-sftp-file-management
**Fecha**: 2026-03-04

## Nota Importante

Esta feature **no persiste datos en base de datos**. Los archivos se almacenan en el filesystem local. Las operaciones SFTP son remotas y sin estado. No se requieren migraciones ni entidades TypeORM.

Los "modelos" descritos aqui son **objetos de dominio en memoria** (Value Objects y Result DTOs).

## Value Objects

### FilePathValueObject

Valida y sanitiza rutas de archivo para prevenir path traversal (usado en operaciones de storage local).

```
FilePathValueObject
└── value: string    (ruta relativa sanitizada, sin ../ ni caracteres peligrosos)
```

**Reglas de validacion**:
- La ruta no puede estar vacia
- Se hace trim y se normalizan separadores a `/`
- Se resuelve contra `STORAGE_BASE_PATH` usando `path.resolve()`
- Si la ruta resuelta NO comienza con `STORAGE_BASE_PATH`, se lanza `EntityError('Ruta invalida: acceso fuera del directorio base')`
- Se rechaza si contiene `\0` (null byte)

**Ejemplo**:
```
Input:  "inbox/partner-a/../partner-b/report.csv"
Base:   "/data/files"
Resolved: "/data/files/inbox/partner-b/report.csv"
✓ Comienza con /data/files → VALIDO

Input:  "../../etc/passwd"
Base:   "/data/files"
Resolved: "/etc/passwd"
✗ No comienza con /data/files → EntityError
```

### SftpConnectionValueObject

Valida la configuracion de conexion a un servidor SFTP externo.

```
SftpConnectionValueObject
├── host: string        (hostname o IP del servidor SFTP)
├── port: number        (puerto, default 22)
├── username: string    (usuario SFTP)
├── password?: string   (password, opcional si se usa privateKey)
└── privateKey?: string (clave privada SSH, opcional si se usa password)
```

**Reglas de validacion**:
- `host` no puede estar vacio
- `port` debe ser un numero entre 1 y 65535
- `username` no puede estar vacio
- Al menos uno de `password` o `privateKey` debe estar presente
- Las credenciales NUNCA se loggean ni se incluyen en mensajes de error

## Result DTOs — Storage Local

### FileInfoResult

Informacion de un archivo en el storage local.

```
FileInfoResult
├── name: string          (nombre del archivo)
├── path: string          (ruta relativa al storage base)
├── size: number          (tamano en bytes)
├── modifiedAt: string    (fecha de ultima modificacion, ISO 8601)
└── isDirectory: boolean  (true si es directorio)
```

### ListFilesResult

```
ListFilesResult
├── directory: string          (ruta del directorio consultado)
└── files: FileInfoResult[]    (lista de archivos/directorios)
```

### DownloadFileResult

```
DownloadFileResult
├── stream: ReadableStream    (stream del contenido del archivo)
├── fileName: string          (nombre del archivo)
└── size: number              (tamano en bytes)
```

### UploadFileResult

```
UploadFileResult
├── path: string     (ruta relativa donde se almaceno)
└── size: number     (tamano en bytes)
```

### MoveFileResult

```
MoveFileResult
├── sourcePath: string        (ruta origen)
└── destinationPath: string   (ruta destino)
```

### DeleteFileResult

```
DeleteFileResult
└── deletedPath: string    (ruta del archivo eliminado)
```

## Result DTOs — Cliente SFTP

### RemoteFileInfoResult

Informacion de un archivo en un servidor SFTP externo.

```
RemoteFileInfoResult
├── name: string          (nombre del archivo)
├── path: string          (ruta en el servidor remoto)
├── size: number          (tamano en bytes)
├── modifiedAt: string    (fecha de ultima modificacion, ISO 8601)
└── isDirectory: boolean  (true si es directorio)
```

### SftpListFilesResult

```
SftpListFilesResult
├── directory: string              (ruta del directorio remoto consultado)
└── files: RemoteFileInfoResult[]  (lista de archivos/directorios remotos)
```

### SftpDownloadFileResult

```
SftpDownloadFileResult
├── stream: ReadableStream    (stream del contenido del archivo remoto)
├── fileName: string          (nombre del archivo)
└── size: number              (tamano en bytes)
```

### SftpDownloadToLocalResult

```
SftpDownloadToLocalResult
├── remotePath: string    (ruta origen en servidor SFTP)
├── localPath: string     (ruta destino en storage local)
└── size: number          (tamano en bytes)
```

### SftpMoveFileResult

```
SftpMoveFileResult
├── sourcePath: string        (ruta origen en servidor remoto)
└── destinationPath: string   (ruta destino en servidor remoto)
```

### SftpDeleteFileResult

```
SftpDeleteFileResult
└── deletedPath: string    (ruta del archivo eliminado en servidor remoto)
```

## Puertos (Interfaces de Servicio)

### IFileStorageService (Storage Local)

Clase abstracta que define el contrato para operaciones de storage local.

```
IFileStorageService (abstract class)
├── listFiles(directoryPath: string) → Promise<ListFilesResult>
├── downloadFile(filePath: string) → Promise<DownloadFileResult>
├── uploadFile(filePath: string, fileStream: Readable, overwrite: boolean) → Promise<UploadFileResult>
├── moveFile(sourcePath: string, destPath: string, overwrite: boolean) → Promise<MoveFileResult>
├── deleteFile(filePath: string) → Promise<DeleteFileResult>
└── fileExists(filePath: string) → Promise<boolean>
```

Todas las rutas recibidas ya estan validadas por `FilePathValueObject` a nivel del handler. El servicio trabaja con rutas absolutas resueltas.

### ISftpClientService (Cliente SFTP)

Clase abstracta que define el contrato para operaciones en servidores SFTP externos.

```
ISftpClientService (abstract class)
├── listFiles(connection: SftpConnectionValueObject, directoryPath: string) → Promise<SftpListFilesResult>
├── downloadFile(connection: SftpConnectionValueObject, filePath: string) → Promise<SftpDownloadFileResult>
├── downloadToLocal(connection: SftpConnectionValueObject, remotePath: string, localPath: string, overwrite: boolean) → Promise<SftpDownloadToLocalResult>
├── moveFile(connection: SftpConnectionValueObject, sourcePath: string, destPath: string) → Promise<SftpMoveFileResult>
└── deleteFile(connection: SftpConnectionValueObject, filePath: string) → Promise<SftpDeleteFileResult>
```

Cada operacion recibe la conexion como parametro. El servicio abre la conexion, ejecuta la operacion y cierra la conexion. Las credenciales nunca se persisten.

## Diagrama de Relaciones

```
┌──────────────────┐
│  Otra API        │ ──HTTP──▶ FileController (/files/*)
│  (WRF, ECMWF)   │
└──────────────────┘
          │
          ▼
┌──────────────────┐
│  FileController   │ ── usa ──▶ CommandBus / QueryBus
└──────────────────┘
          │
          ▼
┌──────────────────┐
│  Command/Query    │
│  Handlers         │ ── usa ──▶ IFileStorageService (puerto)
└──────────────────┘
          │
          ▼
┌──────────────────────────┐
│  LocalFileStorageService  │ ── implementa ──▶ IFileStorageService
│  (node:fs/promises)       │
└──────────────────────────┘
          │
          ▼
┌──────────────────┐
│  Filesystem       │
│  /data/files/     │  ← STORAGE_BASE_PATH
└──────────────────┘


┌──────────────────┐
│  Servicio interno │ ──HTTP──▶ SftpController (/sftp/*)
└──────────────────┘
          │
          ▼
┌──────────────────┐
│  SftpController   │ ── usa ──▶ CommandBus / QueryBus
└──────────────────┘
          │
          ▼
┌──────────────────┐
│  Command/Query    │
│  Handlers         │ ── usa ──▶ ISftpClientService (puerto)
└──────────────────┘                      │
          │                               │ (para download-to-local)
          │                               ▼
          │                    IFileStorageService
          ▼
┌──────────────────────────┐
│  SftpClientService        │ ── implementa ──▶ ISftpClientService
│  (ssh2-sftp-client)       │
└──────────────────────────┘
          │
          ▼
┌──────────────────┐
│  Servidores SFTP  │
│  Externos         │
└──────────────────┘
```
