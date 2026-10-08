-- ─────────────────────────────────────────────────────────────────────────────
-- Deja la base lista para trabajar en serio después de usarla de demo.
--
-- Borra lo que se cargó probando: ventas, servicios técnicos, inventario,
-- clientes, cotizaciones, reservas, egresos, liquidaciones, traspasos,
-- auditorías, y también las cuentas y las fichas de técnicos del demo.
-- Conserva la configuración: roles, sucursales y datos del negocio. Los
-- contadores de notas vuelven a cero: la próxima venta de cada sucursal es V001.
--
-- Como se van todas las cuentas, después hay que crear la primera:
--   php artisan usuarios:super-admin <correo>
--
-- Todo corre dentro de una transacción:
--   sin `-v confirmar=si`  muestra qué se borra, lo borra para comprobar que se
--                          puede y al final lo deshace. No cambia nada.
--   con `-v confirmar=si`  lo deja aplicado.
--
-- El TRUNCATE va sin CASCADE a propósito: si una tabla que se conserva apuntara
-- a una que se borra, PostgreSQL se niega y no se toca nada, en vez de vaciar
-- también la que se conserva.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
\pset footer off

BEGIN;

-- Si la app tiene una tabla tomada, mejor fallar que quedarse esperando.
SET LOCAL lock_timeout = '15s';

CREATE TEMP TABLE _borrar (tabla text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _borrar VALUES
    -- movimientos
    ('ventas'), ('ventas_items'), ('reservas'), ('reserva_items'),
    ('servicio_tecnicos'), ('cotizaciones'), ('clientes'), ('egresos'),
    ('liquidaciones'), ('traspasos'), ('traspaso_items'),
    -- inventario
    ('celulares'), ('computadoras'), ('productos_apple'), ('productos_generales'),
    ('piezas'), ('movimientos_pieza'), ('inventory_audits'), ('inventory_audit_items'),
    -- las cuentas del demo y lo que cuelga de ellas
    ('users'), ('sessions'), ('password_reset_tokens'), ('tecnicos'),
    -- avisos y reportes armados con los datos de prueba
    ('promociones_enviadas'), ('system_notifications'),
    ('automation_reports'), ('automation_report_views'),
    -- caché y cola: guardan cosas que apuntan a lo que se borra
    ('cache'), ('cache_locks'), ('jobs'), ('job_batches'), ('failed_jobs');

CREATE TEMP TABLE _conservar (tabla text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _conservar VALUES
    ('roles'), ('sucursales'), ('configuracion_negocio'), ('secuencias'), ('migrations');

\echo
\echo '=== SE BORRA (filas que hay ahora) ==='
SELECT b.tabla,
       (xpath('/row/n/text()',
              query_to_xml(format('SELECT count(*) AS n FROM %I', b.tabla), false, true, '')))[1]::text::int AS filas
FROM _borrar b
ORDER BY filas DESC, b.tabla;

\echo '=== TABLAS QUE ESTE SCRIPT NO CONOCE (no se tocan; si aparece alguna, revisarla antes de confirmar) ==='
SELECT tablename AS tabla
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (SELECT tabla FROM _borrar UNION SELECT tabla FROM _conservar)
ORDER BY 1;

\echo '=== SE BORRA: estas cuentas y estas fichas de técnicos ==='
SELECT 'cuenta' AS que, u.name || ' (' || coalesce(r.nombre, u.rol) || ')' AS nombre
FROM users u
LEFT JOIN roles r ON r.clave = u.rol
UNION ALL
SELECT 'técnico', nombre || ' (' || especialidad || ')' FROM tecnicos
ORDER BY 1, 2;

\echo '=== SE CONSERVA: sucursales, roles y datos del negocio ==='
SELECT 'sucursal' AS que, nombre AS dato, '' AS valor FROM sucursales
UNION ALL
SELECT 'rol', nombre, '' FROM roles
UNION ALL
SELECT 'negocio', coalesce(nullif(etiqueta, ''), clave), left(valor, 40)
FROM configuracion_negocio
WHERE coalesce(valor, '') <> ''
ORDER BY 1, 2;

SELECT 'TRUNCATE TABLE ' || string_agg(format('%I', tabla), ', ' ORDER BY tabla) || ' RESTART IDENTITY'
FROM _borrar
\gexec

UPDATE secuencias SET ultimo_numero = 0, updated_at = now();

\echo '=== DESPUÉS DE BORRAR (tiene que dar 0) ==='
SELECT sum((xpath('/row/n/text()',
                  query_to_xml(format('SELECT count(*) AS n FROM %I', tabla), false, true, '')))[1]::text::int) AS filas_que_quedan
FROM _borrar;

\if :{?confirmar}
    COMMIT;
    \echo '>>> LIMPIEZA APLICADA. Ahora crea la primera cuenta: php artisan usuarios:super-admin <correo>'
\else
    ROLLBACK;
    \echo '>>> PRUEBA: se deshizo todo y la base quedó como estaba. Para aplicarla, repetir con -v confirmar=si'
\endif
