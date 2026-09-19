# Desplegar el demo de Blackphone

Blackphone se publica en un subdominio de prueba **sin tocar el sitio que ya
está en producción**. Los dos viven en el mismo VPS, pero separados: carpeta
distinta, repositorio distinto, base de datos distinta, claves distintas y
volúmenes distintos.

Lo único que comparten es el **reverse proxy**. El servidor tiene un solo Caddy
escuchando en los puertos 80 y 443 —no puede haber dos—, así que el demo se
cuelga de ese Caddy con un bloque propio. Es el único archivo del proyecto real
que se toca, y se le agrega un bloque: no se modifica ninguno existente.

```
                    Internet
                       │
                  Cloudflare
                       │
                 Caddy (80/443)          ← del proyecto real
                   │        │
      appleboss.com.bo   demo.appleboss.com.bo
             │                    │
      app (real)          blackphone-demo-app
             │                    │
      db (real)           db (del demo)
```

---

## 1. Qué hace falta

- Acceso SSH al VPS.
- El proyecto real corriendo, con su red `appleboss-production_edge`.
- Un registro DNS del subdominio apuntando al VPS.

---

## 2. DNS en Cloudflare

En la zona `appleboss.com.bo`, agregar:

| Tipo | Nombre | Contenido        | Proxy   |
|------|--------|------------------|---------|
| A    | `demo` | *(IP del VPS)*   | Proxied |

No se toca ningún registro existente: se agrega uno.

Si al emitir el certificado Caddy no logra validar el dominio, poner **solo**
este registro en **DNS only** (nube gris), esperar a que emita, comprobar que
`https://` abre, y volver a dejarlo en **Proxied**.

---

## 3. Primera instalación en el VPS

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/santiagoAbasto/Sistema-Backphone.git blackphone-demo
cd blackphone-demo
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
ADMIN_PASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-20)"

sed -i "s|^APP_KEY=.*|APP_KEY=${APP_KEY}|" .env.production
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env.production
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|" .env.production
sed -i "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=${ADMIN_PASS}|" .env.production

echo "Clave del administrador: ${ADMIN_PASS}"
```

Falta completar a mano `SEED_ADMIN_EMAIL` con el correo de la primera cuenta.

Levantar:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
```

Crear las tablas y la primera cuenta:

```bash
docker compose -f docker-compose.production.yml exec blackphone php artisan migrate --force
docker compose -f docker-compose.production.yml exec blackphone php artisan db:seed --force
```

Comprobar que la aplicación responde por dentro, antes de tocar Caddy:

```bash
docker compose -f docker-compose.production.yml exec blackphone curl -s -o /dev/null -w '%{http_code}\n' http://localhost/up
```

Tiene que decir `200`.

---

## 4. Publicar el subdominio

El bloque a agregar está en `docker/production/blackphone-demo.caddy`. Se pega
al final del Caddyfile del proyecto real.

**Antes de editar, copia de seguridad:**

```bash
cd ~/apps/appleboss
cp docker/production/Caddyfile docker/production/Caddyfile.bak
```

Agregar el bloque y reiniciar únicamente Caddy:

```bash
docker compose -f docker-compose.production.yml restart caddy
docker compose -f docker-compose.production.yml logs --tail=50 caddy
```

> El reinicio de Caddy corta el sitio real **uno o dos segundos**, lo que tarda
> el proceso en volver a levantar. Los certificados ya emitidos están en el
> volumen `caddy_data`, así que no se vuelven a pedir.

Comprobar desde afuera:

```bash
curl -I https://demo.appleboss.com.bo
curl -s -o /dev/null -w '%{http_code}\n' https://demo.appleboss.com.bo/up
```

---

## 5. Actualizaciones

```bash
cd ~/apps/blackphone-demo
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

- **`ports:` en el demo.** Ni la aplicación ni PostgreSQL se asoman al servidor.
  Caddy llega por la red interna de Docker; nadie más tiene por qué.
- **El nombre del servicio web.** Se llama `blackphone`, no `app`. En una red
  compartida Compose registra el nombre del servicio como alias DNS: un servicio
  llamado `app` compartiría alias con el del proyecto real y Caddy repartiría el
  tráfico del sitio de producción entre los dos.
- **`APP_DEBUG`.** Queda en `false`. En `true`, cualquier error muestra la
  configuración entera, variables de entorno incluidas.
- **`.env.production`.** No se versiona ni se pega en un chat.
- **Las claves.** El demo tiene su propia base, su propia `APP_KEY` y su propia
  contraseña de administrador. Ninguna se comparte con el sitio real.

---

## 7. Si algo falla

**El subdominio no abre.** Revisar que el registro A exista y apunte al VPS, y
que el bloque esté en el Caddyfile:

```bash
curl -I https://demo.appleboss.com.bo
```

**502 Bad Gateway.** Caddy encontró el dominio pero no llega a la aplicación:

```bash
cd ~/apps/blackphone-demo
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 blackphone
docker network inspect appleboss-production_edge | grep -A3 blackphone
```

El contenedor tiene que aparecer en esa red con el alias `blackphone-demo-app`.

**Error de Laravel con la pantalla en blanco.** El log del contenedor lo dice:

```bash
docker compose -f docker-compose.production.yml logs --tail=100 blackphone
docker compose -f docker-compose.production.yml exec blackphone php artisan about
```

Revisar `APP_KEY`, `APP_URL`, los datos de PostgreSQL y si faltan migraciones.
No pegar el contenido de `.env.production` en ningún lado.

---

## 8. Antes de mostrar el demo

- [ ] `https://demo.appleboss.com.bo/up` responde `200`.
- [ ] `https://appleboss.com.bo` sigue abriendo igual que antes.
- [ ] `APP_DEBUG=false` y `APP_ENV=production`.
- [ ] La contraseña del administrador no es la de ningún otro sistema.
- [ ] Ajustes → Datos del negocio está completado (sale en las notas y PDF).
- [ ] Probado desde el celular y en una ventana de incógnito.
