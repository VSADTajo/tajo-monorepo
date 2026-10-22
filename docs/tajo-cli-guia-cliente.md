# Cómo levantar Tajo en tu servidor 🌊

Esta guía te lleva paso a paso para poner **toda la plataforma Tajo a andar en tu
máquina**, sin necesidad de conocer los detalles de adentro. Son dos comandos:

```bash
git clone <URL-que-te-pasamos> tajo && cd tajo
bin/tajo up
```

`bin/tajo up` hace todo solo:

- **Construye** cada servicio a partir del código del repo (siempre corre
  exactamente lo que bajaste con `git`, nunca una imagen vieja).
- Usa la **configuración ya lista** en `infra/.env` (viene en el repo, no hay
  nada que completar).
- **Carga nuestros datos** (usuarios, estaciones, modelos, capas…) desde
  `infra/seed/` en las bases que estén vacías.
- Arranca la infraestructura (bases de datos, RabbitMQ, Redis, GeoServer) y
  todos los servicios.

> **¿Cuánto tarda?** La primera vez unos 15–25 minutos (construye todas las
> imágenes). Después, arrancar es cuestión de segundos.

---

## 1. ¿Qué máquina necesito?

| Recurso | Recomendado | Mínimo |
|---------|-------------|--------|
| RAM     | 8 GB        | 6 GB   |
| CPU     | 4 vCPU      | 2 vCPU |
| Disco   | 60 GB       | 40 GB  |
| Sistema | Linux (Ubuntu 22.04 / 24.04 va perfecto) | |

La máquina necesita **salida a internet** (GitHub, Docker Hub, npm y
`docker.osgeo.org`) para construir la primera vez.

---

## 2. Antes de empezar

1. **Docker** con el plugin `docker compose`:

   ```bash
   docker --version
   docker compose version
   ```

   Si alguno falla: <https://docs.docker.com/engine/install/>

2. **Acceso a GitHub** a la organización VSADTajo (te lo damos nosotros). Es el
   mismo acceso con el que clonás este repo; `tajo` lo reutiliza para bajar el
   frontend, que vive en otro repo.

---

## 3. Traer Tajo y arrancar 🚀

```bash
git clone <URL-que-te-pasamos> tajo
cd tajo
bin/tajo doctor     # opcional: chequea que esté todo en orden antes de arrancar
bin/tajo up
```

Cuando termina vas a ver:

```
✓ stack is up — open http://<IP-de-tu-servidor>:8080 · run 'tajo status' to see health
```

Entrá con **tu usuario de siempre**: los usuarios vienen en los datos que
cargamos, no hace falta crear ninguno.

### ¿Tu servidor tiene un dominio?

`tajo` detecta la IP de la máquina y la usa para que el navegador llegue a la
plataforma. Si querés usar un dominio (o la IP detectada no es la correcta),
agregalo al final de `infra/.env` y volvé a correr `bin/tajo up`:

```bash
PUBLIC_HOST=tajo.tu-dominio.es
```

---

## 4. Comprobar que todo está vivo

```bash
bin/tajo status
```

Deberías ver la lista de servicios en `healthy`. Y en el navegador:

| Qué vas a ver | Dirección |
|---------------|-----------|
| La aplicación principal | `http://TU-SERVIDOR:8080` |
| Panel de logs | `http://TU-SERVIDOR:3005` |
| Mapas / GeoServer | `http://TU-SERVIDOR:8085/geoserver` |

---

## 5. El día a día

```bash
bin/tajo status              # ¿cómo está todo?
bin/tajo logs                # ver qué está pasando (Ctrl+C para salir)
bin/tajo restart <servicio>  # reiniciar algo puntual
bin/tajo down                # apagar todo (los datos quedan guardados)
```

### Actualizar a una versión nueva

```bash
git pull
bin/tajo up
```

`up` reconstruye lo que cambió y aplica solas las migraciones de base de datos
nuevas. **Tus datos no se tocan**: el seed de `infra/seed/` solo se carga en
bases vacías.

### Actualización automática (opcional) ⏰

Un cron que haga `git pull` y después `bin/tajo up`:

```bash
sudo crontab -e
```

```
*/10 * * * * cd /ruta/a/tajo && git pull --quiet && bin/tajo up >> /var/log/tajo-autoupdate.log 2>&1
```

Mantené la carpeta del repo limpia (sin ediciones locales salvo `PUBLIC_HOST`
en `infra/.env`), porque el `git pull` del cron podría pisarlas.

### Guardar una copia de seguridad

```bash
bin/tajo backup      # guarda todo en la carpeta backups/
```

---

## 6. Si algo no funciona 🔧

**Primer paso siempre**: `bin/tajo doctor`. Te dice puntualmente qué está mal.

| Lo que ves | Qué suele ser |
|------------|---------------|
| `cannot clone …vsad-tajo-frontend` | La máquina no tiene acceso a GitHub de VSADTajo. Pedinos acceso. |
| Falla el build de algún servicio | Sin salida a internet (npm / Docker Hub). Revisá firewall/proxy y reintentá `bin/tajo up`. |
| `seed failed for: …` | La carga de datos falló y esa base quedó vacía. Mandanos el mensaje; reintentar `bin/tajo up` vuelve a intentarlo. |
| No abre en el navegador | La IP detectada no es la que usás: poné `PUBLIC_HOST=` en `infra/.env` y `bin/tajo up`. Revisá también el firewall (puertos 3000, 8080, 8085). |
| Backoffice quedó viejo tras actualizar | Hard refresh en el navegador (Ctrl+Shift+R). |

### Volver a cargar nuestros datos desde cero

⚠️ Reemplaza los datos actuales de las bases por los del repo:

```bash
bin/tajo seed --force
bin/tajo up
```

---

## ¿Trabado? Escribinos 🙌

Copiá lo que muestran `bin/tajo status` y `bin/tajo logs`, mandanoslo y lo
resolvemos juntos.
