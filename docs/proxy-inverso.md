# Publicar Tagus FlowCast detrás de un proxy inverso (HTTPS)

Esta guía explica cómo publicar la plataforma en un dominio con TLS, por ejemplo
`https://tagusflowcast.saihchtajo.es`, con el proxy en otra máquina.

## Esquema de rutas

| Ruta pública   | Destino (servidor de la aplicación) | Notas                       |
|----------------|-------------------------------------|-----------------------------|
| `/`            | `vsad-tajo-frontend` · puerto 8080  | Aplicación principal        |
| `/api/`        | `ms-gateway-api` · puerto 3000      | **Quitando** el prefijo `/api` |
| `/geoserver/`  | GeoServer · puerto 8085             | **Sin** quitar el prefijo   |

En este modo, el frontend usa rutas relativas a su propio origen (`/api/...` y
`/geoserver/...`). No hay ninguna IP ni ningún `http://` en el bundle, así que no
hay contenido mixto. Ya no hace falta el `sub_filter` en el proxy.

## Configuración en el servidor de la aplicación

1. Cread (o editad) `infra/.env.local`. Este archivo no está versionado y
   `git pull` no lo toca:

   ```bash
   PUBLIC_BASE_URL=https://tagusflowcast.saihchtajo.es
   ```

2. Aplicad la configuración:

   ```bash
   git pull && bin/tajo up
   ```

   `tajo up` reconstruye el frontend con las rutas relativas y reinicia los
   servicios afectados. Los datos no se tocan.

## Variables disponibles

Todas van en `infra/.env.local`. Salvo `PUBLIC_BASE_URL`, todas son opcionales.

| Variable | Por defecto | Para qué sirve |
|----------|-------------|----------------|
| `PUBLIC_BASE_URL` | *(vacía)* | URL pública detrás del proxy. Si está definida, el frontend usa `/api` y `/geoserver`, y GeoServer anuncia sus URLs bajo ese dominio. |
| `ALLOWED_ORIGINS` | `*` | Orígenes permitidos por CORS en el gateway, separados por comas. Con el esquema de rutas de arriba, la aplicación y la API comparten origen y CORS no interviene. Si lo restringís, incluid también los paneles internos que llaman al gateway, por ejemplo `https://tagusflowcast.saihchtajo.es,http://192.168.202.104:3005,http://192.168.202.104:5174`. |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Saltos de los que el gateway acepta `X-Forwarded-For/Proto/Host` (valor de *trust proxy* de Express). Admite nombres, IPs o CIDR separados por comas, o un número de saltos. El valor por defecto confía en redes privadas; si el proxy usa una IP pública, poned aquí su IP. |
| `FRONTEND_API_URL` | `/api` con proxy | URL de la API compilada en el frontend. Cambiadla solo si usáis otra ruta. |
| `FRONTEND_GEOSERVER_URL` | `/geoserver` con proxy | URL de GeoServer compilada en el frontend. |
| `GEOSERVER_PROXY_BASE_URL` | `PUBLIC_BASE_URL` + `/geoserver` | URL que GeoServer escribe en sus *capabilities* y en su panel de administración. |
| `GEOSERVER_CSRF_WHITELIST` | dominio público + IP del servidor | Dominios desde los que se puede usar el panel de administración de GeoServer. |
| `PUBLIC_HOST` | IP de la máquina | Host para el acceso directo, sin proxy (paneles internos de logs y SFTP). |

Si `PUBLIC_BASE_URL` está vacía, todo funciona como hasta ahora: acceso directo
por `http://IP:puerto`.

## Ejemplo de configuración de nginx

```nginx
server {
    listen 443 ssl http2;
    server_name tagusflowcast.saihchtajo.es;
    # ssl_certificate ... ; ssl_certificate_key ... ;

    # Subida de escenarios (hasta 1 GB) y consultas largas.
    client_max_body_size 1g;
    proxy_read_timeout 300s;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;

    location / {
        proxy_pass http://VCMAS104:8080;
    }

    # La barra final en proxy_pass quita el prefijo /api.
    location /api/ {
        proxy_pass http://VCMAS104:3000/;
    }

    location /geoserver/ {
        proxy_pass http://VCMAS104:8085/geoserver/;
    }
}
```

## Qué queda fuera del proxy

El panel de logs (`:3005`) y el panel SFTP (`:5174`) son herramientas internas.
Siguen accesibles por `http://IP:puerto` dentro de la red, con sus URLs
configuradas al arrancar el contenedor (no van fijas en la imagen). No hay que
publicarlos en el proxy para que la aplicación principal funcione.

## Comprobación

```bash
curl -sI https://tagusflowcast.saihchtajo.es/                       # 200
curl -s  https://tagusflowcast.saihchtajo.es/api/health             # {"status":"ok",...}
curl -s 'https://tagusflowcast.saihchtajo.es/geoserver/Tajo/wms?service=WMS&request=GetCapabilities' \
  | grep -o 'https://tagusflowcast[^"]*' | head -1                  # las URLs anunciadas usan el dominio
```

En el navegador, la pestaña *Red* no debe mostrar ninguna petición a
`http://192.168...`.
