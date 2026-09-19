<?php

namespace App\Support;

use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

/**
 * Con qué sucursal está trabajando quien tiene la sesión abierta.
 *
 * Hay dos clases de cuenta:
 *
 * - **Atada a una sucursal** (`users.sucursal_id` con valor): ve y carga solo en la suya.
 *   No puede cambiarla; el selector ni siquiera aparece.
 * - **Super administrador** (`users.sucursal_id` en null): ve todas. Elige en el selector con cuál
 *   trabajar, y puede poner «Todas» para mirar el negocio entero de una vez. Lo que elige vive en
 *   la sesión, así que no se le pierde al navegar.
 *
 * `id()` es lo que se usa para filtrar (null = todas). `paraGuardar()` es a qué sucursal va un
 * registro nuevo: nunca es null, porque una venta siempre pasa en algún lado.
 */
final class SucursalActiva
{
    private const CLAVE_SESION = 'sucursal_activa';

    /** La sucursal por la que se filtra. `null` significa «todas». */
    public static function id(): ?int
    {
        $usuario = Auth::user();

        if (! $usuario) {
            return null;
        }

        if (! static::puedeElegir($usuario)) {
            return (int) $usuario->sucursal_id;
        }

        $elegida = session(self::CLAVE_SESION);

        return $elegida === null ? null : (int) $elegida;
    }

    /**
     * A qué sucursal se guarda un registro nuevo.
     *
     * El super administrador que está mirando «Todas» tiene que elegir una antes de cargar algo:
     * en ese caso devuelve la primera activa, para que nunca quede un registro sin sucursal.
     */
    public static function paraGuardar(): ?int
    {
        if ($id = static::id()) {
            return $id;
        }

        return Sucursal::activas()->first()?->id;
    }

    /** ¿Esta cuenta puede moverse entre sucursales? */
    public static function puedeElegir(?User $usuario = null): bool
    {
        $usuario ??= Auth::user();

        return $usuario !== null && $usuario->sucursal_id === null;
    }

    /** Guarda la sucursal elegida. `null` = todas. Solo tiene efecto en quien puede elegir. */
    public static function elegir(?int $id): void
    {
        if (! static::puedeElegir()) {
            return;
        }

        if ($id === null) {
            session()->forget(self::CLAVE_SESION);

            return;
        }

        $existe = Sucursal::where('id', $id)->where('activa', true)->exists();

        if ($existe) {
            session([self::CLAVE_SESION => $id]);
        }
    }

    /** Lo que el panel muestra arriba: las opciones, cuál está elegida y si se puede cambiar. */
    public static function paraElPanel(): ?array
    {
        $usuario = Auth::user();

        if (! $usuario) {
            return null;
        }

        $puedeElegir = static::puedeElegir($usuario);
        $actual      = static::id();

        return [
            'actual'      => $actual,
            'puedeElegir' => $puedeElegir,
            'verTodas'    => $puedeElegir && $actual === null,
            'opciones'    => $puedeElegir
                ? Sucursal::paraElSelector()
                : Sucursal::where('id', $usuario->sucursal_id)->get(['id', 'nombre', 'prefijo', 'ciudad'])->toArray(),
        ];
    }
}
