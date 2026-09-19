<?php

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Horario laboral del vendedor: fuera de las ventanas configuradas no puede iniciar sesión.
 *
 * La hora se mira en la zona horaria de la tienda (America/La_Paz), no en la del servidor.
 * En pruebas, si nadie fijó una hora con Carbon::setTestNow(), se permite todo (así la batería
 * de tests que entra con actingAs no depende de la hora real en que se corre).
 */
class HorarioLaboral
{
    /** ¿Un vendedor puede entrar en este momento? */
    public static function permitido(?CarbonInterface $momento = null): bool
    {
        // En tests sin hora fijada, no restringimos (los tests que sí lo prueban usan setTestNow).
        if ($momento === null && app()->runningUnitTests() && ! Carbon::hasTestNow()) {
            return true;
        }

        $t = ($momento ? $momento->copy() : Carbon::now())
            ->setTimezone((string) config('horario.timezone', 'America/La_Paz'));

        if (! in_array($t->dayOfWeekIso, (array) config('horario.dias', [1, 2, 3, 4, 5, 6, 7]), true)) {
            return false;
        }

        $hm = $t->format('H:i');
        foreach ((array) config('horario.ventanas', []) as [$inicio, $fin]) {
            if ($hm >= $inicio && $hm < $fin) {
                return true;
            }
        }

        return false;
    }

    /** Texto legible del horario, para el mensaje de error. */
    public static function descripcion(): string
    {
        $partes = array_map(
            fn ($v) => sprintf('%s a %s', $v[0], $v[1]),
            (array) config('horario.ventanas', [])
        );

        return implode(' y ', $partes);
    }

    /** Mensaje que ve el vendedor cuando intenta entrar fuera de horario. */
    public static function mensaje(): string
    {
        return 'Fuera del horario de atención (' . self::descripcion() . '). No podés iniciar sesión ahora.';
    }
}
