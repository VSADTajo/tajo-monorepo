# Modo directo FEWS — contrato de integración

Documento para confirmar con Idrica antes de habilitar el modo directo en producción.

Todo lo que sigue está tomado de la **especificación OpenAPI oficial** del servicio
(`Delft-FEWS Web Services REST API v1`), descargable en:

```
https://fewsdocs.deltares.nl/webservices/rest-api/v1/delft-fews-webservices-rest-api-v1-oas3.json
```

No es una deducción nuestra: es el contrato publicado por Deltares. Lo que hay que
confirmar es la **instancia** (URL, ids, credenciales, versión), no la forma de las
llamadas.

---

## 1. Lo que necesitamos de Idrica

| Dato | Para qué | Estado |
|---|---|---|
| URL base del `FewsWebServices` | Endpoint raíz, ej. `https://host/FewsWebServices` | **pendiente** |
| `workflowId` | Workflow a lanzar. Definido dentro de su FEWS; no tiene default | **pendiente** |
| `filterId` | Filtro bajo el que se publica el input y se leen los resultados | **pendiente** |
| Usuario / password | Solo si el servicio pide basic auth | **pendiente** |
| Versión de Delft-FEWS | Ver §4: de ella depende que podamos leer los resultados | **pendiente** |
| ¿Disponibilidad continua? | Si el servicio se levanta a ratos, el modo directo no sirve para producción | **pendiente** |

El `servicePath` (`/rest/fewspiservice/v1`) es el estándar; si su despliegue lo tiene
en otra ruta, se corrige con una variable de entorno sin tocar código.

---

## 2. Las cuatro llamadas que hacemos

### 2.1 Enviar el input

```
POST {base}/rest/fewspiservice/v1/timeseries?filterId={filterId}
Content-Type: application/json

<documento PI-JSON>
```

- El cuerpo es el mismo documento que hoy dejamos en el SFTP
  (`Q_mod_input_<YYYYMMDDHHMM>.json`).
- **Validado contra el schema oficial** de PI-JSON
  (`schemas/pirest/pi_rest_timeseries.json`): ver el test
  `manual-simulation-file.schema.spec.ts` en ms-predictions-api. El schema declara
  `additionalProperties: false` en todos los niveles, así que una clave de más
  sería un rechazo — por eso está pinneado en un test y no verificado a ojo.
- La respuesta es un documento **PI Diag** (`application/xml`). Un 200 no significa
  que la importación ocurrió: el Diag reporta `"N time series imported, M time
  series rejected"`. Leemos ese contador y las líneas de nivel ≤ 1, y fallamos si
  algo fue rechazado.

### 2.2 Lanzar el workflow

```
POST {base}/rest/fewspiservice/v1/runtask
  ?workflowId={workflowId}
  &startTime=2026-07-29T00:00:00Z
  &endTime=2026-08-01T00:00:00Z
  &description=Manual simulation <simulationId>
  &runOption=all
```

- `workflowId` es el único parámetro obligatorio.
- `runOption` admite `all | alloneatatime | allmostrecentonly`; usamos `all`.
- La respuesta es `text/plain` y el cuerpo entero es el **task id**.
- Las fechas van con precisión de segundo y sin milisegundos.

### 2.3 Seguir la tarea

```
GET {base}/rest/fewspiservice/v1/taskrunstatus
  ?taskId={taskId}
  &documentFormat=PI_JSON
  &maxWaitMillis=1000
```

- `documentFormat=PI_JSON` **es obligatorio en la práctica**: sin él la respuesta es
  `text/plain` con la letra del estado suelta (`"P"`), no un objeto.
- El JSON es **plano**: `{ version, code, description, taskRunId }`. No hay un objeto
  `status` que los envuelva.
- Códigos de estado (tabla del spec):

  | Código | Significado | Cómo lo tratamos |
  |---|---|---|
  | `P` | pending | sigue en vuelo, reintentamos |
  | `R` | running | sigue en vuelo, reintentamos |
  | `C` | completed fully successful | resultados usables |
  | `D` | completed partly successful | resultados usables |
  | `A` | approved | resultados usables |
  | `B` | approved partly successful | resultados usables |
  | `F` | failed | fallo terminal |
  | `T` | terminated | fallo terminal |
  | `I` | invalid | fallo terminal |

  Cualquier código fuera de esta lista se trata como desconocido y **nunca** como
  éxito.

### 2.4 Leer los resultados

```
GET {base}/rest/fewspiservice/v1/timeseries
  ?documentFormat=PI_JSON
  &filterId={filterId}
  &taskRunIds={taskRunId}
```

El PI-JSON que vuelve se parsea con el mismo mapper que ya usamos para los archivos
del SFTP, incluido el manejo del sufijo `.web` y de las series sin metadata de
ejecución.

---

## 3. Lo que NO cambia

El modo directo solo cambia **cómo llega el input al modelo y cómo se sigue la
corrida**. El archivo de input se sigue generando y guardando igual, y todo lo que
va después de leer el resultado (parser → calculator → predicciones) es idéntico a
los otros modos. El modo SFTP sigue existiendo y se elige por simulación.

---

## 4. El punto a confirmar con más cuidado: `taskRunId`

El schema oficial dice, sobre el campo `taskRunId` de `taskrunstatus`:

> *"Since 2024.01. the taskrun id for this task run. null if not available"*

Los resultados se piden **por `taskRunId`**. Si su instancia es anterior a 2024.01,
o devuelve `null`, no tenemos con qué direccionar los resultados y el modo directo
no puede completarse tal como está implementado.

Hoy eso falla de forma explícita, con un mensaje que dice exactamente esto, en vez de
dejar la simulación esperando para siempre. Pero si su versión es anterior, hace
falta una alternativa — leer por `filterId` y ventana temporal, por ejemplo — y eso
es trabajo adicional. **Por eso conviene preguntar la versión antes que la URL.**

---

## 5. Cómo lo validamos de nuestro lado sin su servidor

El modo `MOCK` del backoffice ejecuta este mismo flujo contra un PI REST falso local
que implementa las cuatro llamadas de arriba con las formas del spec. Eso valida
nuestro lado del cable: serialización, la máquina de estados del polling, el parseo
del PI-JSON y el manejo de errores.

**No valida su instancia.** Un MOCK en verde significa que si algo falla cuando nos
den la URL, el problema no está en nuestro código — no que vaya a andar.

### Los dos fixtures del mock

En `tajo/mock/` del SFTP conviven dos respuestas, y la diferencia importa:

| archivo | qué es |
|---|---|
| `tagus_Q_mod_202607271100.json` | **el que sirve el mock**: la respuesta completa, como sería una corrida sana. Entrada y 5 series EPS para los 38 embalses que el calculator computa, así que las 228 previsiones se llenan. Generado por `ms-model-api/scripts/build-complete-mock-output.mjs`. |
| `tagus_Q_mod_202607271100.DEGRADADO-REAL.json` | **lo que FEWS manda hoy de verdad**: caudal de entrada en `-999` para todos los embalses menos dos, y ninguna serie de EPS. Es la evidencia de §6 y reproduce el problema. |

El mock sirve el completo a propósito: un mock existe para responder "¿funciona el
pipeline cuando el modelo se porta bien?", y reproducir una respuesta degradada no
puede contestar eso. La detección de que FEWS entrega mal corresponde a las
corridas por SFTP y FEWS_API, no al mock.

Para reproducir el problema real, se intercambian los dos archivos.

---

## 6. La evidencia sobre lo que FEWS entrega hoy

Medido sobre la respuesta real del 27-jul, embalse por embalse:

- **Caudal de salida** (`Q.salida.forecast`): 52 embalses, 281 de 289 valores reales. Bien.
- **Caudal de entrada** (`I.mk11.forecast`): 22 embalses tienen la serie, pero **solo 2 traen valores** (E_11 y E_21). Los otros 20 vienen con los 289 puntos en `-999`.
- **Series EPS**: **ninguna**. El calculator espera cinco por embalse
  (`I.mk11.EPS10forecast`, `EPS25`, `EPS`, `EPS75`, `EPS90`) y no llega una.

Sin caudal de entrada no hay balance de volumen posible, así que de 228 previsiones
se llenan 2. Pasa igual en las corridas reales por SFTP, así que no es del modo
directo ni del mock.

Las dos preguntas para Idrica:

1. ¿Por qué el MIKE11 produce caudal de entrada con datos solo para E_11 y E_21, y
   manda `-999` para los otros 20 que sí tienen caudal de salida?
2. ¿Por qué no vienen las series de EPS, si el sistema las necesita para los
   percentiles?
