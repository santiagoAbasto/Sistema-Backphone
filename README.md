# Blackphone — Sistema de gestión

Sistema interno para una tienda de tecnología: inventario, ventas, reservas, servicio técnico,
cotizaciones, egresos, clientes y reportes, con un panel para administración y otro para vendedores.

Es un sistema **privado**: no tiene tienda pública ni ninguna pantalla abierta a internet.
Todo lo que hay detrás de `/` pide sesión.

---

## Qué trae

| Módulo | Qué resuelve |
| --- | --- |
| **Resumen** | Cómo va el día y el mes, avisos y reportes automáticos. |
| **Ventas** | Registro con varios ítems, permuta, pago con tarjeta y boleta en A4 y 80 mm. |
| **Reservas** | Separar un producto con anticipo, con su comprobante y control de vencimiento. |
| **Servicio técnico** | Ingreso, costo, estado del equipo y recibo para el cliente. |
| **Cotizaciones** | Armado, PDF, envío por correo y por WhatsApp (individual o en lote). |
| **Egresos** | Gastos del negocio con su exportación en PDF. |
| **Clientes** | Ficha, historial de compras y actividad. |
| **Inventario** | Celulares, computadoras, equipos de marca y accesorios, con condición Nuevo/Seminuevo, IMEI y número de serie. |
| **Auditoría** | Conteo físico contra el sistema, con resolución de diferencias y PDF. |
| **Reportes** | Ventas, ganancias y cierres por día, semana, mes y año. |
| **Exportaciones** | PDF de inventario por tipo, por nombre o con un filtro armado a mano. |
| **Usuarios y roles** | Roles con permisos por módulo. El vendedor tiene su propio panel. |
| **Sucursales** | Varias sucursales, cada una con su inventario, sus ventas y sus códigos de nota. |
| **Datos del negocio** | Nombre, NIT, contacto y dirección: es lo que sale impreso en cada comprobante. |

## Sucursales

El sistema trabaja con varias sucursales. Viene con dos cargadas, **Cochabamba** (`CBA`) y
**Sucre** (`SUC`), y desde **Sistema → Sucursales** se agregan, se editan o se apagan.

Cada sucursal se administra sola: su inventario, sus ventas, sus reservas, sus servicios, sus
clientes y sus egresos son suyos y no se mezclan con los de la otra. Los códigos de nota llevan
adelante el prefijo de la sucursal —`CBA-V001`, `SUC-V001`—, así dos cajas pueden vender al mismo
tiempo en ciudades distintas sin que un código se repita.

### Quién ve qué

Al dar acceso se eligen dos cosas: **el rol** (a qué módulos entra) y **la sucursal** (con cuál
trabaja).

| Cuenta | Qué ve |
| --- | --- |
| **Con sucursal asignada** | Solo la suya. No hay forma de mirar otra, ni escribiendo la dirección a mano. |
| **Sin sucursal** (super administrador) | Todas. Elige con cuál trabajar desde el selector del encabezado, o «Todas» para ver el negocio sumado. |

El aislamiento no depende de que cada pantalla se acuerde de filtrar: lo aplica un alcance global
sobre los modelos (`App\Models\Concerns\DeSucursal`), y lo que se carga queda en la sucursal
activa de quien lo carga.

Un administrador de sucursal puede dar acceso a su propia sucursal, pero no crear super
administradores ni cuentas en otra: nadie reparte más alcance del que tiene. Y el sistema no deja
quedarse sin super administradores ni apagar la última sucursal encendida.

## Cómo está hecho

- **Laravel 13** con **Inertia** y **React 19**
- **PostgreSQL 18**
- **Tailwind CSS** con el sistema de diseño en `src/resources/css/tokens.css`
- **Vite** para el frontend, **dompdf** para los comprobantes
- Todo corre en **Docker**

---

## Levantarlo

Hace falta Docker y nada más.

```bash
cp .env.example .env
```

Completá `POSTGRES_PASSWORD` en `.env` con una contraseña propia, y después:

```bash
docker compose up -d --build
```

La primera vez, preparar la aplicación:

```bash
cp src/.env.example src/.env
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate
```

Queda en **http://127.0.0.1:8030**.

### La primera cuenta

El primer administrador lo crea `UserSeeder` con lo que haya en `src/.env`:

```
SEED_ADMIN_NAME=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

Con esas tres variables cargadas:

```bash
docker compose exec app php artisan db:seed
```

El seeder **nunca** cambia la contraseña de una cuenta que ya existe. Los demás usuarios se crean
desde **Usuarios y roles**, dentro del panel.

### Los servicios

| Servicio | Para qué | Puerto |
| --- | --- | --- |
| `app` | La aplicación (Apache + PHP 8.5) | 8030 |
| `db` | PostgreSQL 18 | 5440 |
| `queue` | Cola de trabajos en segundo plano | — |
| `scheduler` | Tareas programadas | — |
| `node` | Compila el frontend (`FRONTEND_MODE=dev` para recarga en caliente) | 5180 |
| `adminer` | Cliente web de la base (perfil `herramientas`) | 8031 |

```bash
# Con el cliente de base de datos
docker compose --profile herramientas up -d
```

---

## Trabajar en el frontend

Con `FRONTEND_MODE=dev` en `.env`, el contenedor `node` levanta Vite con recarga en caliente.
Con `build` (el valor por defecto) compila una vez y se queda quieto.

```bash
docker compose exec node npx vite build   # compilar a mano
```

## Pruebas

```bash
docker compose exec app php artisan test
```

---

## La identidad

Todo el color, la tipografía, los radios, las sombras y los tiempos de animación viven en
**`src/resources/css/tokens.css`**. Es el único lugar donde se cambian: la interfaz entera los sigue.

- **Negro** (`--carbon-*`) para el armazón: barra lateral, encabezado, botones principales.
- **Bronce** (`--bronce-*`) para el acento: lo activo, lo seleccionado, lo que hay que mirar.
- **Neutros cálidos** (`--gris-*`) para el contenido, que es donde se leen los datos.
- **Chakra Petch** para la marca y los títulos, **Inter** para la interfaz, **IBM Plex Mono** para
  códigos, IMEI y números de serie.

El isotipo está dibujado en `src/resources/js/Components/Marca/Isotipo.jsx` (SVG en el código, no
una imagen). Para usar el archivo oficial de la marca, dejarlo en `public/images/marca/` y cambiar
ese componente por un `<img>`.

## Seguridad

- Contraseñas con mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.
  En producción se verifica además que no estén en listas de filtraciones.
- Con `APP_ENV=production` se fuerzan HTTPS, HSTS y una CSP estricta.
- Ninguna contraseña, token ni correo personal se escribe en el código: todo sale de `.env`.
- El vendedor solo inicia sesión dentro del horario de `src/config/horario.php`.
