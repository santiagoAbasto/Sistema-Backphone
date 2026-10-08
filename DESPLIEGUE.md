# Desplegar Blackphone

Blackphone se publica en su propio dominio, `blackphone.com.bo`, **sin tocar el
sitio que ya está en producción**. Los dos viven en el mismo VPS, pero separados: carpeta
distinta, repositorio distinto, base de datos distinta, claves distintas y
volúmenes distintos.

Lo único que comparten es el **reverse proxy**. El servidor tiene un solo Caddy
escuchando en los puertos 80 y 443 —no puede haber dos—, así que Blackphone se
cuelga de ese Caddy con un bloque propio. Es el único archivo del proyecto real
que se toca, y se le agrega un bloque: no se modifica ninguno existente.

```
                    Internet
                       │
                  Cloudflare
                       │
                 Caddy (80/443)          ← del proyecto real
                   │        │
      appleboss.com.bo     blackphone.com.bo
             │                    │
      app (real)            blackphone-app
             │                    │
      db (real)             db (de Blackphone)
```

---

## 1. Qué hace falta

- Acceso SSH al VPS.
- El proyecto real corriendo, con su red `appleboss-production_edge`.
- El dominio `blackphone.com.bo` en Cloudflare, apuntando al VPS.

---

## 2. DNS en Cloudflare

`blackphone.com.bo` es una zona propia en Cloudflare; la de `appleboss.com.bo`
no se toca. En la zona `blackphone.com.bo`:

| Tipo | Nombre | Contenido        | Proxy    |
|------|--------|------------------|----------|
| A    | `@`    | *(IP del VPS)*   | DNS only |
| A    | `www`  | *(IP del VPS)*   | DNS only |

Cloudflare entrega dos *nameservers*; se cargan en NIC Bolivia (nic.bo) como
servidores DNS del dominio. Hasta que la zona figure **Active** y
`dig +short blackphone.com.bo` devuelva la IP del VPS, no se toca Caddy: si no,
no puede emitir el certificado.

Con `https://` ya funcionando se puede pasar a **Proxied**, pero antes hay que
poner **SSL/TLS → Full (strict)** en la zona. En *Flexible* Cloudflare le habla
por HTTP a Caddy, Caddy redirige a HTTPS y el navegador queda en un bucle.

---

## 3. Primera instalación en el VPS

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/santiagoAbasto/Sistema-Backphone.git blackphone
cd blackphone
```

Preparar el archivo de variables:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Generar las claves y escribirlas dentro de `.env.production` de una vez. La
contraseña de la base va en dos variables —`DB_PASSWORD` para Laravel y
`POSTGRES_PASSWORD` para PostgreSQL— y tiene que ser la misma en las dos:

```bash
APP_KEY="base64:$(openssl rand -base64 32)"
DB_PASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-28)"

sed -i "s|^APP_KEY=.*|APP_KEY=${APP_KEY}|" .env.production
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env.production
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|" .env.production
```

Levantar:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
```

Crear las tablas y la primera cuenta:

```bash
docker compose -f docker-compose.production.yml exec blackphone php artisan migrate --force
docker compose -f docker-compose.production.yml exec blackphone php artisan db:seed --force
docker compose -f docker-compose.production.yml exec blackphone php artisan usuarios:super-admin correo@dominio
```

El último pide la contraseña dos veces y no la muestra al escribirla: no queda en el
`.env` ni en el historial de la terminal. La cuenta sale como super administrador
(rol admin, sin sucursal). El resto del equipo se crea desde Usuarios y roles.

Comprobar que la aplicación responde por dentro, antes de tocar Caddy:

```bash
docker compose -f docker-compose.production.yml exec blackphone curl -s -o /dev/null -w '%{http_code}\n' http://localhost/up
```

Tiene que decir `200`.

---

## 4. Publicar el dominio

El bloque a agregar está en `docker/production/blackphone.caddy`. Se pega
al final del Caddyfile del proyecto real.

**Antes de editar, copia de seguridad:**

```bash
cd ~/apps/appleboss
cp docker/production/Caddyfile docker/production/Caddyfile.bak
```

El Caddyfile entra al contenedor como archivo suelto
(`Caddyfile:/etc/caddy/Caddyfile`). Editarlo con `sed -i` o con un editor que
guarde en un archivo nuevo deja al contenedor mirando el viejo: hay que escribir
encima con `cat nuevo > Caddyfile`, que conserva el mismo archivo. Después,
validar y recién entonces reiniciar únicamente Caddy:

```bash
docker compose -f docker-compose.production.yml exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -f docker-compose.production.yml restart caddy
docker compose -f docker-compose.production.yml logs --tail=50 caddy
```

> El reinicio de Caddy corta el sitio real **uno o dos segundos**, lo que tarda
> el proceso en volver a levantar. Los certificados ya emitidos están en el
> volumen `caddy_data`, así que no se vuelven a pedir.

Comprobar desde afuera:

```bash
curl -I https://blackphone.com.bo
curl -s -o /dev/null -w '%{http_code}\n' https://blackphone.com.bo/up
```

---

## 5. Actualizaciones

```bash
cd ~/apps/blackphone
git pull --ff-only origin main
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d --force-recreate
```

Si la actualización trae migraciones:

```bash
docker compose -f docker-compose.production.yml exec blackphone php artisan migrate --force
```

Si solo cambió `.env.production`, no hace falta `git pull` ni `build`:

```bash
docker compose -f docker-compose.production.yml up -d --force-recreate blackphone queue scheduler
```

---

## 6. Lo que no se toca

- **`ports:` en Blackphone.** Ni la aplicación ni PostgreSQL se asoman al servidor.
  Caddy llega por la red interna de Docker; nadie más tiene por qué.
- **El nombre del servicio web.** Se llama `blackphone`, no `app`. En una red
  compartida Compose registra el nombre del servicio como alias DNS: un servicio
  llamado `app` compartiría alias con el del proyecto real y Caddy repartiría el
  tráfico del sitio de producción entre los dos.
- **`APP_DEBUG`.** Queda en `false`. En `true`, cualquier error muestra la
  configuración entera, variables de entorno incluidas.
- **`.env.production`.** No se versiona ni se pega en un chat.
- **Las claves.** Blackphone tiene su propia base, su propia `APP_KEY` y su propia
  contraseña de administrador. Ninguna se comparte con el sitio real.

---

## 7. Si algo falla

**El dominio no abre.** Revisar que el registro A exista y apunte al VPS, y
que el bloque esté en el Caddyfile:

```bash
curl -I https://blackphone.com.bo
```

**502 Bad Gateway.** Caddy encontró el dominio pero no llega a la aplicación:

```bash
cd ~/apps/blackphone
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 blackphone
docker network inspect appleboss-production_edge | grep -A3 blackphone
```

El contenedor tiene que aparecer en esa red con el alias `blackphone-app`.

**Error de Laravel con la pantalla en blanco.** El log del contenedor lo dice:

```bash
docker compose -f docker-compose.production.yml logs --tail=100 blackphone
docker compose -f docker-compose.production.yml exec blackphone php artisan about
```

Revisar `APP_KEY`, `APP_URL`, los datos de PostgreSQL y si faltan migraciones.
No pegar el contenido de `.env.production` en ningún lado.

---

## 8. Antes de entregar

- [ ] `https://blackphone.com.bo/up` responde `200`.
- [ ] `https://appleboss.com.bo` sigue abriendo igual que antes.
- [ ] `APP_DEBUG=false` y `APP_ENV=production`.
- [ ] La contraseña del administrador no es la de ningún otro sistema.
- [ ] Ajustes → Datos del negocio está completado (sale en las notas y PDF).
- [ ] Probado desde el celular y en una ventana de incógnito.

---

## 9. De demo a producción: dejar la base limpia

Si la instalación se usó de demo, `docker/production/limpiar-datos-de-prueba.sql`
borra todo lo cargado probando (ventas, servicios, inventario, clientes, egresos,
traspasos, cuentas y fichas de técnicos) y conserva roles, sucursales y datos del
negocio. Los contadores de notas vuelven a cero.

Antes, una copia:

```bash
docker compose -f docker-compose.production.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > ~/blackphone-antes-de-limpiar.dump
```

Sin `-v confirmar=si` el script muestra qué borraría, lo borra para comprobar que se
puede y lo deshace; con `-v confirmar=si` lo aplica:

```bash
docker compose -f docker-compose.production.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < docker/production/limpiar-datos-de-prueba.sql
```

Como también se van las cuentas, después se crea la primera con
`php artisan usuarios:super-admin` (sección 3).
