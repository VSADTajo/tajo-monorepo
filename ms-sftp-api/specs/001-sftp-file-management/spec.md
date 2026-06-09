# Especificacion de Feature: Hub de Archivos (Storage Local + Cliente SFTP)

**Feature Branch**: `001-sftp-file-management`
**Creado**: 2026-03-04
**Estado**: Borrador
**Input**: "Sistema de archivos que sea punto de entrada y salida del sistema. Gente de afuera puede meter archivos, y el sistema puede leer archivos de otros servidores SFTP externos."

## Contexto

Esta API es el **hub central de archivos** del sistema. Tiene dos capacidades:

1. **Storage Local (entrada)**: Actores externos y servicios internos (WRF, ECMWF) suben y descargan archivos via REST. Los archivos se almacenan en el filesystem local bajo `STORAGE_BASE_PATH`.

2. **Cliente SFTP (salida)**: El sistema se conecta a servidores SFTP externos para leer, descargar y mover archivos remotos. Permite consumir archivos de terceros sin que estos necesiten integrarse directamente.

```
Actores externos ──upload──▶ ┌──────────────┐ ──sftp-client──▶ SFTP Externo 1
WRF ──upload/download──▶     │  ESTA API     │ ──sftp-client──▶ SFTP Externo 2
ECMWF ──upload/download──▶   │  (hub central) │ ──sftp-client──▶ SFTP Externo N
Otros servicios ──────▶      └──────────────┘
                                    │
                                    ▼
                              /data/files/ (storage local)
```

## Escenarios de Usuario y Pruebas *(obligatorio)*

---

### MODULO 1: Storage Local (`/files/*`)

---

### Historia de Usuario 1 - Subir un Archivo al Storage Local (Prioridad: P1)

Como sistema externo o servicio interno, quiero subir un archivo a esta API especificando una ruta destino, para que quede almacenado y disponible para otros sistemas.

**Por que esta prioridad**: Es la capacidad fundamental de entrada. Sin poder recibir archivos, el hub no tiene contenido que servir.

**Prueba Independiente**: Se puede probar subiendo un archivo via multipart/form-data y verificando que existe en el storage.

**Escenarios de Aceptacion**:

1. **Dado** un archivo y una ruta destino (ej: `inbox/partner-a/report.csv`), **Cuando** el consumidor sube el archivo, **Entonces** el sistema lo almacena en `{STORAGE_BASE_PATH}/inbox/partner-a/report.csv` y retorna confirmacion con la ruta y tamano.
2. **Dado** una ruta destino cuyo directorio padre no existe, **Cuando** el consumidor sube el archivo, **Entonces** el sistema crea los directorios intermedios automaticamente.
3. **Dado** una ruta destino donde ya existe un archivo, **Cuando** el consumidor sube sin `overwrite: true`, **Entonces** el sistema retorna error 409.
4. **Dado** `overwrite: true`, **Cuando** se sube el archivo, **Entonces** el sistema sobreescribe el existente.

---

### Historia de Usuario 2 - Listar Archivos del Storage Local (Prioridad: P2)

Como servicio interno, quiero listar los archivos en un directorio del storage local, para descubrir que archivos estan disponibles.

**Por que esta prioridad**: Necesario para que los consumidores descubran archivos antes de descargarlos o moverlos.

**Prueba Independiente**: Listar un directorio con archivos previamente subidos y verificar el listado.

**Escenarios de Aceptacion**:

1. **Dado** un directorio con archivos, **Cuando** se solicita listar, **Entonces** el sistema retorna nombre, tamano y fecha de modificacion de cada entrada.
2. **Dado** un directorio vacio, **Cuando** se solicita listar, **Entonces** retorna lista vacia.
3. **Dado** un directorio inexistente, **Cuando** se solicita listar, **Entonces** retorna error 404.

---

### Historia de Usuario 3 - Descargar un Archivo del Storage Local (Prioridad: P3)

Como servicio interno, quiero descargar un archivo por su ruta desde el storage local.

**Por que esta prioridad**: La descarga es la accion principal de consumo interno.

**Prueba Independiente**: Descargar un archivo previamente subido y verificar contenido identico.

**Escenarios de Aceptacion**:

1. **Dado** una ruta existente, **Cuando** se solicita descarga, **Entonces** retorna el contenido como stream binario.
2. **Dado** una ruta inexistente, **Entonces** retorna error 404.
3. **Dado** un archivo mayor a 100 MB, **Entonces** se maneja via streaming sin agotamiento de memoria.

---

### Historia de Usuario 4 - Mover un Archivo en el Storage Local (Prioridad: P4)

Como servicio interno, quiero mover un archivo de una ruta a otra en el storage local, para organizar archivos post-procesamiento (ej: `inbox/` a `processed/`).

**Por que esta prioridad**: Habilita flujos de trabajo de procesamiento de archivos.

**Prueba Independiente**: Mover un archivo y verificar que ya no existe en origen y esta en destino.

**Escenarios de Aceptacion**:

1. **Dado** ruta origen existente y ruta destino, **Cuando** se solicita mover, **Entonces** el archivo se reubica y ya no existe en el origen.
2. **Dado** directorio destino inexistente, **Entonces** se crean directorios intermedios automaticamente.
3. **Dado** archivo existente en destino sin `overwrite: true`, **Entonces** retorna error 409.
4. **Dado** ruta origen inexistente, **Entonces** retorna error 404.

---

### Historia de Usuario 5 - Eliminar un Archivo del Storage Local (Prioridad: P5)

Como servicio interno, quiero eliminar un archivo del storage local.

**Por que esta prioridad**: Limpieza para completar el ciclo de vida.

**Prueba Independiente**: Eliminar un archivo y verificar que ya no aparece en el listado.

**Escenarios de Aceptacion**:

1. **Dado** una ruta existente, **Cuando** se solicita eliminar, **Entonces** el archivo se borra.
2. **Dado** una ruta inexistente, **Entonces** retorna error 404.

---

### MODULO 2: Cliente SFTP (`/sftp/*`)

---

### Historia de Usuario 6 - Listar Archivos en Servidor SFTP Externo (Prioridad: P6)

Como servicio interno, quiero listar archivos en un directorio de un servidor SFTP externo, para descubrir que archivos estan disponibles para consumir.

**Por que esta prioridad**: Es la operacion base del cliente SFTP. Sin listar, no se sabe que archivos hay disponibles en el servidor remoto.

**Prueba Independiente**: Conectarse a un servidor SFTP y listar un directorio, verificando el contenido.

**Escenarios de Aceptacion**:

1. **Dado** credenciales validas y un directorio remoto, **Cuando** se solicita listar, **Entonces** retorna lista de archivos con nombre, tamano y fecha de modificacion.
2. **Dado** credenciales invalidas, **Entonces** retorna error 401.
3. **Dado** directorio remoto inexistente, **Entonces** retorna error 404.

---

### Historia de Usuario 7 - Descargar Archivo desde Servidor SFTP Externo (Prioridad: P7)

Como servicio interno, quiero descargar un archivo desde un servidor SFTP externo, para incorporarlo al sistema.

**Por que esta prioridad**: Es la accion principal de "consumir archivos de otros FTP".

**Prueba Independiente**: Descargar un archivo remoto y verificar que el contenido llega correctamente.

**Escenarios de Aceptacion**:

1. **Dado** credenciales validas y una ruta de archivo remoto, **Cuando** se solicita descargar, **Entonces** retorna el contenido del archivo como stream.
2. **Dado** archivo remoto inexistente, **Entonces** retorna error 404.
3. **Dado** un archivo mayor a 100 MB, **Entonces** se maneja via streaming.

---

### Historia de Usuario 8 - Descargar de SFTP Externo y Guardar en Storage Local (Prioridad: P8)

Como servicio interno, quiero descargar un archivo desde un SFTP externo y guardarlo directamente en el storage local, para incorporar archivos al hub sin pasos intermedios.

**Por que esta prioridad**: Flujo combinado que evita que el consumidor tenga que descargar y re-subir manualmente.

**Prueba Independiente**: Ejecutar la operacion y verificar que el archivo aparece en el storage local.

**Escenarios de Aceptacion**:

1. **Dado** credenciales SFTP validas, una ruta remota y una ruta local destino, **Cuando** se solicita la transferencia, **Entonces** el archivo se descarga del SFTP externo y se almacena en el storage local.
2. **Dado** archivo ya existe en destino local sin `overwrite: true`, **Entonces** retorna error 409.

---

### Historia de Usuario 9 - Mover Archivo en Servidor SFTP Externo (Prioridad: P9)

Como servicio interno, quiero mover un archivo en un servidor SFTP externo, para marcar archivos como procesados en el servidor remoto.

**Por que esta prioridad**: Permite organizar archivos post-consumo en el servidor del tercero.

**Prueba Independiente**: Mover un archivo remoto y verificar que ya no esta en origen y si en destino.

**Escenarios de Aceptacion**:

1. **Dado** credenciales validas, ruta origen y destino en el servidor remoto, **Cuando** se solicita mover, **Entonces** el archivo se reubica.
2. **Dado** archivo origen inexistente, **Entonces** retorna error 404.

---

### Historia de Usuario 10 - Eliminar Archivo en Servidor SFTP Externo (Prioridad: P10)

Como servicio interno, quiero eliminar un archivo en un servidor SFTP externo.

**Por que esta prioridad**: Limpieza en servidores remotos despues de consumir archivos.

**Escenarios de Aceptacion**:

1. **Dado** credenciales validas y ruta existente, **Cuando** se solicita eliminar, **Entonces** el archivo se borra del servidor remoto.
2. **Dado** ruta inexistente, **Entonces** retorna error 404.

---

### Casos Borde

**Storage Local:**
- Path traversal con `../` → el sistema DEBE sanitizar y rechazar con error 400.
- Disco lleno durante subida → error 500, limpiar archivo parcial.
- Subida simultanea al mismo archivo → ultimo en escribir gana (sin locking en alcance inicial).
- Directorios vacios despues de mover/eliminar → se mantienen.
- Ruta sin directorio (ej: `report.csv`) → se almacena en la raiz del `STORAGE_BASE_PATH`.

**Cliente SFTP:**
- Conexion SFTP se cae a mitad de transferencia → error de conexion perdida, limpiar archivos parciales.
- Servidor SFTP inalcanzable o timeout → error dentro del timeout configurado.
- Archivos con caracteres especiales en nombres → se pasan tal cual al servidor.
- Permisos denegados en servidor remoto → error 403.

## Requerimientos *(obligatorio)*

### Requerimientos Funcionales

**Storage Local:**
- **FR-001**: El sistema DEBE permitir subir archivos via multipart/form-data con ruta destino relativa a `STORAGE_BASE_PATH`.
- **FR-002**: El sistema DEBE crear directorios intermedios automaticamente al subir o mover archivos.
- **FR-003**: El sistema DEBE listar archivos en un directorio local, retornando nombre, tamano y fecha de modificacion.
- **FR-004**: El sistema DEBE descargar archivos locales como stream binario con headers `Content-Disposition` y `Content-Length`.
- **FR-005**: El sistema DEBE mover archivos entre rutas dentro del storage local.
- **FR-006**: El sistema DEBE eliminar archivos del storage local.
- **FR-007**: El sistema DEBE rechazar sobreescritura a menos que se envie `overwrite: true`.
- **FR-008**: El sistema DEBE sanitizar rutas contra path traversal.

**Cliente SFTP:**
- **FR-009**: El sistema DEBE permitir conectarse a servidores SFTP externos con credenciales por solicitud (host, port, username, password o privateKey).
- **FR-010**: El sistema DEBE listar archivos en directorios de servidores SFTP externos.
- **FR-011**: El sistema DEBE descargar archivos desde servidores SFTP externos como stream.
- **FR-012**: El sistema DEBE poder descargar de un SFTP externo y guardar directamente en el storage local (transferencia directa).
- **FR-013**: El sistema DEBE mover archivos en servidores SFTP externos.
- **FR-014**: El sistema DEBE eliminar archivos en servidores SFTP externos.
- **FR-015**: El sistema DEBE cerrar conexiones SFTP despues de cada operacion.
- **FR-016**: El sistema DEBE soportar timeouts configurables de conexion (default 10s) y operacion (default 60s).

**Compartidos:**
- **FR-017**: El sistema DEBE retornar respuestas de error estructuradas para todos los escenarios.
- **FR-018**: `STORAGE_BASE_PATH` DEBE ser configurable via variable de entorno.

### Requerimientos No Funcionales

- **NFR-001**: Transferencias de hasta 500 MB DEBEN completarse sin agotamiento de memoria (streaming).
- **NFR-002**: Todas las operaciones DEBEN registrar accion, ruta y resultado para auditabilidad.
- **NFR-003**: El sistema DEBE manejar al menos 10 operaciones concurrentes sin degradacion.
- **NFR-004**: Las credenciales SFTP NUNCA se loggean ni se persisten.

### Entidades Clave

- **StoredFile**: Archivo en storage local — ruta relativa, nombre, tamano, fecha de modificacion.
- **RemoteFile**: Archivo en servidor SFTP externo — ruta, nombre, tamano, fecha de modificacion.
- **SftpConnection**: Configuracion de conexion a servidor externo — host, port, username, credenciales, timeouts.

## Criterios de Exito *(obligatorio)*

### Resultados Medibles

- **SC-001**: Los consumidores pueden listar archivos locales en menos de 2 segundos para directorios con hasta 1,000 archivos.
- **SC-002**: Un archivo de 50 MB puede descargarse del storage local en menos de 10 segundos.
- **SC-003**: Mover archivos locales se completa en menos de 1 segundo.
- **SC-004**: Listar archivos de un SFTP externo retorna resultados en menos de 5 segundos.
- **SC-005**: Descargar un archivo de 50 MB desde un SFTP externo se completa en menos de 30 segundos.
- **SC-006**: El 100% de las operaciones retornan errores estructurados en caso de falla.
- **SC-007**: Las 10 operaciones (5 locales + 5 SFTP) estan disponibles y funcionales.
- **SC-008**: Ningun intento de path traversal permite acceso fuera de la ruta base.

## Supuestos

- Las rutas de archivo usan barras diagonales (`/`) como separadores.
- Archivos individuales, sin recursion de directorios en alcance inicial.
- Tamano maximo por archivo: 500 MB.
- Sin autenticacion/autorizacion de consumidores en el alcance inicial.
- Storage local en filesystem del servidor.
- Servidores SFTP externos son SSH/SFTP estandar (protocolo version 2+).
- Credenciales SFTP se proporcionan por solicitud (no se persisten).

## Fuera de Alcance

- Operaciones recursivas de directorio.
- Transferencias programadas o automatizadas (jobs tipo cron).
- Protocolo FTP no seguro — solo SFTP para conexiones externas.
- Almacenamiento persistente de credenciales SFTP.
- Almacenamiento en cloud (S3, MinIO).
- Transformacion o parsing del contenido de archivos.
- Interfaz web — solo API.
- Subir archivos a servidores SFTP externos (solo lectura/consumo de externos en esta version).
