# Cómo levantar Tajo en tu servidor 🌊

Esta guía te lleva paso a paso para poner **toda la plataforma Tajo a andar en tu
máquina**, sin necesidad de conocer los detalles de adentro. Si sabés copiar y
pegar comandos en una terminal, podés hacerlo.

Todo se maneja con una sola herramienta: **`tajo`**. Ella se encarga de bajar los
programas, arrancarlos y mantenerlos vivos. Vos solo la llamás.

> **¿Cuánto tarda?** Unos 15–20 minutos la primera vez (la mayoría es esperar a
> que se descarguen las imágenes). Después, arrancar es cuestión de segundos.

---

## 1. ¿Qué máquina necesito? (spoiler: no una gigante)

Tajo es una plataforma completa, pero **no hace falta un servidor enorme**. Con
una VM modesta va sobrada:

| Recurso | Recomendado | Mínimo |
|---------|-------------|--------|
| RAM     | 8 GB        | 6 GB   |
| CPU     | 4 vCPU      | 2 vCPU |
| Disco   | 60 GB       | 40 GB  |
| Sistema | Linux (Ubuntu 22.04 / 24.04 va perfecto) | |

> 💡 **Nota honesta:** nuestra propia máquina de pruebas es bastante más grande
> que esto — está **sobredimensionada** para lo que Tajo realmente consume. No
> copies ese tamaño. Con lo de la columna "Recomendado" te alcanza y te sobra.
> Si más adelante necesitás más, ampliar la VM es fácil.

Además la máquina necesita **salida a internet** para descargar los programas
(hacia `ghcr.io` y `docker.osgeo.org`).

---

## 2. Antes de empezar: dos cosas instaladas

1. **Docker** (con el plugin `docker compose`). Para comprobar que están:

   ```bash
   docker --version
   docker compose version
   ```

   Si alguno falla, instalá Docker siguiendo la guía oficial:
   <https://docs.docker.com/engine/install/>

2. **Una clave de acceso de GitHub** (te la damos nosotros) para poder bajar los
   programas de Tajo. Es un texto largo que empieza con `ghp_...`.

---

## 3. Traer Tajo a tu máquina

```bash
git clone <URL-que-te-pasamos> tajo
cd tajo
```

A partir de acá, todos los comandos se corren **dentro de la carpeta `tajo`**.

---

## 4. Completar la configuración

Tajo trae un archivo de ejemplo con toda la configuración. Copialo y editalo:

```bash
cp infra/.env.example infra/.env
nano infra/.env      # o el editor que prefieras
```

Adentro vas a ver muchas líneas, pero **solo unas pocas son importantes para vos**.
Buscá estas, cambialas y guardá:

| Qué | Poné acá… |
|-----|-----------|
| `JWT_SECRET` | Un texto largo e inventado (cuanto más largo, mejor) |
| `POSTGRES_PASSWORD` | Una contraseña para la base de datos |
| `RABBITMQ_PASSWORD` | Otra contraseña |
| `PUBLIC_API_URL` | La dirección pública de tu servidor, ej: `http://200.10.5.20:3000` |

Y **agregá estas dos líneas al final del archivo** (no vienen en el ejemplo):

```bash
X_API_KEY=un-texto-secreto-inventado
AEMET_API_KEY=la-clave-de-aemet-que-te-pasamos
```

- `X_API_KEY` es **obligatoria** — sin ella Tajo no arranca. Inventá un texto secreto.
- `AEMET_API_KEY` es para los datos del clima; si todavía no la tenés, podés dejarla
  vacía y cargarla después.

> El resto podés dejarlo como viene. La `PUBLIC_API_URL` es la que ve tu gente
> desde el navegador, así que poné la **IP o el dominio real de tu servidor**, no
> `localhost`.

---

## 5. Iniciar sesión para descargar Tajo

Pegá la clave de GitHub que te dimos (reemplazá las dos partes):

```bash
echo <TU-CLAVE-GITHUB> | docker login ghcr.io -u <TU-USUARIO-GITHUB> --password-stdin
```

Si dice `Login Succeeded`, listo. 👍

---

## 6. Chequeo pre-arranque (nuevo, evita sorpresas) 🩺

Antes de levantar nada, corré:

```bash
bin/tajo doctor
```

Esto valida en un solo paso: Docker está bien, la red interna existe, el login
a GHCR está vivo, la versión pineada está disponible (todas las 14 imágenes de
la plataforma existen en el registry) y tu `.env` tiene los secretos
customizados (no los placeholder). Si algo falla lo dice con el fix concreto.

Si termina con `✓ all checks passed`, arrancá.

## 7. ¡Arrancar! 🚀

```bash
bin/tajo up
```

Este comando baja todo lo necesario y lo pone en marcha. La primera vez tarda un
rato (está descargando). Cuando termina, vas a ver:

```
✓ stack is up — run 'tajo status' to see health
```

**Por qué esto es determinístico ahora:** la versión de la plataforma vive en
`infra/version.env` (dentro del repo). Cada vez que hacemos `git pull`, esa
línea se actualiza al último release probado, y `bin/tajo up` baja **exactamente
ese set coherente de imágenes** — nunca más un "mix" donde un servicio quedó
viejo respecto a otro.

Después, preparar la base de datos (esto se hace **una sola vez**):

```bash
bin/tajo migrate
```

---

## 8. Creá tu usuario administrador 👤

La plataforma arranca **sin ningún usuario**. Creá el tuyo (el primer admin, con
acceso total) con un comando — reemplazá el email, la clave y tu nombre:

```bash
bin/tajo create-admin tu@email.com TuClaveSegura "Tu Nombre"
```

- La clave debe tener **al menos 8 caracteres**.
- Este comando **corre una sola vez**: si ya existe un admin, se niega solito (por
  seguridad). Así que no te preocupes por ejecutarlo de más.

Cuando termine vas a ver `✓ admin created`. Con ese email y clave entrás a la app.

---

## 9. Comprobar que todo está vivo

```bash
bin/tajo status
```

Deberías ver la lista de servicios en verde / `healthy`. Y podés abrir en el
navegador:

| Qué vas a ver | Dirección (cambiá `TU-SERVIDOR` por tu IP o dominio) |
|---------------|------------------------------------------------------|
| La aplicación principal | `http://TU-SERVIDOR:8080` |
| Panel de logs | `http://TU-SERVIDOR:3005` |
| Mapas / GeoServer | `http://TU-SERVIDOR:8085/geoserver` |

Entrá a la aplicación principal con el **usuario admin que creaste en el paso 7**.

> ℹ️ Los datos de mapas (capas, estaciones) se cargan aparte con un archivo que te
> pasamos nosotros. Si `mapas` o `hidro` no arrancan del todo, es esto — avisanos
> y te ayudamos a cargarlo.

---

## 10. El día a día (los 4 comandos que vas a usar)

```bash
bin/tajo status              # ¿cómo está todo?
bin/tajo logs                # ver qué está pasando (Ctrl+C para salir)
bin/tajo restart <servicio>  # reiniciar algo puntual
bin/tajo down                # apagar todo (los datos quedan guardados)
```

### Actualizar a una versión nueva

Nosotros publicamos una versión nueva cada vez que mergeamos algo a `main`. La
versión pineada (`TAG`) vive en `infra/version.env` dentro del repo. Para
actualizar:

```bash
git pull             # trae la nueva versión pineada en infra/version.env
bin/tajo doctor      # confirma que la versión nueva es alcanzable y todo está OK
bin/tajo up          # baja las imágenes de esa versión y las levanta
bin/tajo migrate     # solo si te avisamos de un cambio de base de datos
```

### Rollback (volver a una versión anterior)

Si algo salió mal con el release nuevo, podés forzar una versión anterior
específica sin hacer `git`:

```bash
TAG=v2026.09.10.42 bin/tajo up
```

O de forma persistente para tu VM: descomentá `TAG=v2026.09.10.42` en tu
`infra/.env`. Eso overridea la versión de `version.env` hasta que lo saques.

### Actualización automática (opcional pero recomendada) ⏰

Si querés que la VM se actualice sola cada vez que publicamos una versión
nueva, dejá un cron que haga **primero `git pull`** (para traer la nueva
versión pineada) y **después `bin/tajo up`**:

1. Editá el crontab de root:

    ```bash
    sudo crontab -e
    ```

2. Pegá esta línea al final (revisa cada 10 min; ajustá el intervalo a gusto):

    ```
    */10 * * * * cd /ruta/a/tajo && git pull --quiet && bin/tajo up >> /var/log/tajo-autoupdate.log 2>&1
    ```

    Reemplazá `/ruta/a/tajo` por la carpeta donde clonaste el repo.

3. Verificá que el cron esté activo:

    ```bash
    sudo tail -f /var/log/tajo-autoupdate.log
    ```

    Vas a ver una entrada cada 10 min. Si no hay versión nueva, `git pull`
    no trae nada y `bin/tajo up` confirma que el stack está corriendo con la
    versión actual. Si sí hubo release, `git pull` actualiza `version.env` y
    `bin/tajo up` baja el nuevo TAG y recrea los containers afectados.

    **Importante**: como el cron hace `git pull`, si estás editando algo local
    en la carpeta del repo (no debería, pero por si acaso), esa edición se
    puede sobrescribir. Mantené la carpeta del repo limpia.

> **Migraciones**: si publicamos un cambio de base de datos, te vamos a
> avisar por separado — `bin/tajo migrate` no está en el cron a propósito
> (para que no corra por accidente). Cuando toque, lo corrés a mano.

> **Login a GHCR**: el `docker login ghcr.io` del paso 5 se mantiene en la
> VM. Si algún día el PAT caduca, el cron va a fallar con `unauthorized`
> y te lo va a mostrar en el log — ahí volvés a hacer el login con un PAT
> nuevo.

### Guardar una copia de seguridad

```bash
bin/tajo backup      # guarda todo en la carpeta backups/
```

---

## 11. Si algo no funciona 🔧

**Primer paso siempre**: `bin/tajo doctor`. Te dice puntualmente qué está mal
(imagen que no bajó, login vencido, secret no customizado, red que falta...).

| Lo que ves | Qué suele ser |
|------------|---------------|
| `TAG must be set` al hacer `up` | Falta el `infra/version.env` o quedó vacío. Corré `git pull` y volvé a probar. |
| `unauthorized` al arrancar | La clave de GitHub venció o no tiene permisos. Volvé al paso 5 con una clave nueva. |
| Doctor dice `<svc>:<TAG> not found on GHCR` | El release pineado en `version.env` no terminó de publicar todos los servicios. Reintentá en unos minutos o avisanos. |
| Un servicio se reinicia solo | Falta completar algún dato en `infra/.env`. El mensaje de `bin/tajo logs` te dice cuál. |
| `mapas` / `hidro` no llegan a verde | Falta cargar los datos de mapas (el archivo que te pasamos). |
| No abre en el navegador | Revisá que la IP/dominio de `PUBLIC_API_URL` sea el correcto y que el firewall deje pasar los puertos. |
| Entrás pero no ves nada / "sin permisos" | Iniciá sesión con el **usuario admin del paso 8**. Un usuario común no tiene permisos hasta que el admin se los da. |
| `create-admin` dice que ya existe un admin | Correcto: solo corre una vez. Usá el admin que ya creaste. |
| Backoffice quedó viejo tras `git pull` + `bin/tajo up` | Hard refresh en el navegador (Ctrl+Shift+R) o modo incógnito. La UI está cacheada, no el container. |

---

## ¿Trabado? Escribinos 🙌

Si algo no sale, **no te pelees con la terminal**: copiá lo que muestra
`bin/tajo status` y `bin/tajo logs`, mandanoslo y lo resolvemos juntos.

> Para el detalle técnico completo (todas las variables, seed de GeoServer,
> restore, versiones fijas, etc.) está la guía extendida en
> [`tajo-deployment-guide.md`](./tajo-deployment-guide.md).
