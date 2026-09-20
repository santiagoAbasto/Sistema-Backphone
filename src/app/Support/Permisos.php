<?php

namespace App\Support;

/**
 * Qué puede tocar cada rol dentro del panel.
 *
 * Un permiso es un **módulo del panel**, no una acción suelta: es lo que el administrador entiende y lo que se puede
 * cumplir de verdad. Cada módulo lleva los nombres de ruta que le pertenecen, y con eso `PermisoMiddleware` corta el
 * acceso en el servidor; el menú del panel usa la misma lista para no mostrar lo que el rol no puede abrir.
 *
 * Reglas:
 * - El permiso `*` es «todo»: lo tiene el rol `admin` y no se le puede quitar.
 * - Una ruta que no pertenece a ningún módulo (el perfil, cerrar sesión, los avisos) no se bloquea nunca.
 */
class Permisos
{
    public const TODO = '*';

    /**
     * clave => [etiqueta, grupo, prefijos de nombre de ruta].
     * El orden es el del menú del panel.
     */
    public const MODULOS = [
        'resumen'      => ['Resumen',              'Inicio',              ['admin.dashboard', 'admin.notifications']],

        'ventas'       => ['Ventas',               'Ventas y operación',  ['admin.ventas']],
        'reservas'     => ['Reservas',             'Ventas y operación',  ['admin.reservas']],
        'servicios'    => ['Servicio técnico',     'Ventas y operación',  ['admin.servicios']],
        'tecnicos'     => ['Técnicos y comisiones', 'Ventas y operación',  ['admin.tecnicos']],
        'cotizaciones' => ['Cotizaciones',         'Ventas y operación',  ['admin.cotizaciones']],
        'egresos'      => ['Egresos',              'Ventas y operación',  ['admin.egresos']],
        'reportes'     => ['Reportes',             'Ventas y operación',  ['admin.reportes', 'admin.automation']],
        'clientes'     => ['Clientes',             'Ventas y operación',  ['admin.clientes']],

        'inventario'   => ['Inventario',           'Inventario',          ['admin.celulares', 'admin.computadoras', 'admin.productos-apple', 'admin.productos-generales']],
        'piezas'       => ['Piezas y repuestos',   'Inventario',          ['admin.piezas']],
        'traspasos'    => ['Traspasos',            'Inventario',          ['admin.traspasos']],
        'auditoria'    => ['Auditoría',            'Inventario',          ['admin.inventory-audits']],

        'exportar'     => ['Exportar datos',       'Exportar datos',      ['admin.exportaciones', 'admin.exportar']],

        'usuarios'     => ['Usuarios y roles',     'Sistema',             ['admin.usuarios', 'admin.roles']],
        'ajustes'      => ['Datos del negocio',    'Sistema',             ['admin.configuracion']],
        'sucursales'   => ['Sucursales',           'Sistema',             ['admin.sucursales']],
    ];

    /** Los módulos agrupados como los muestra la pantalla de roles. */
    public static function porGrupo(): array
    {
        $grupos = [];
        foreach (self::MODULOS as $clave => [$label, $grupo]) {
            $grupos[$grupo][] = ['clave' => $clave, 'label' => $label];
        }

        return collect($grupos)->map(fn ($modulos, $grupo) => ['grupo' => $grupo, 'modulos' => $modulos])->values()->all();
    }

    public static function claves(): array
    {
        return array_keys(self::MODULOS);
    }

    public static function etiqueta(string $clave): string
    {
        return self::MODULOS[$clave][0] ?? $clave;
    }

    /** A qué módulo pertenece un nombre de ruta. `null` si no es de ninguno (no se bloquea). */
    public static function moduloDeRuta(?string $ruta): ?string
    {
        if ($ruta === null) {
            return null;
        }

        foreach (self::MODULOS as $clave => [, , $prefijos]) {
            foreach ($prefijos as $prefijo) {
                if ($ruta === $prefijo || str_starts_with($ruta, $prefijo . '.')) {
                    return $clave;
                }
            }
        }

        return null;
    }

    /** Deja solo los permisos que existen; `*` gana sobre todo lo demás. */
    public static function limpiar(array $permisos): array
    {
        if (in_array(self::TODO, $permisos, true)) {
            return [self::TODO];
        }

        return array_values(array_intersect(self::claves(), array_unique($permisos)));
    }
}
