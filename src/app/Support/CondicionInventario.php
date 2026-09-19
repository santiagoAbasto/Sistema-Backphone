<?php

namespace App\Support;

use Illuminate\Validation\Rule;

/**
 * Condición comercial que se elige al cargar un producto al inventario (Nuevo / Seminuevo).
 * Nunca se infiere: la elige la persona que carga o edita el producto, y viaja tal cual a la
 * boleta y a los reportes.
 */
final class CondicionInventario
{
    public const VALORES = ['Nuevo', 'Seminuevo'];

    public const MENSAJES = [
        'condicion.required' => 'Elige si es nuevo o seminuevo.',
        'condicion.in'       => 'Elige si es nuevo o seminuevo.',
    ];

    public static function regla(bool $obligatoria = true): array
    {
        return [$obligatoria ? 'required' : 'nullable', Rule::in(self::VALORES)];
    }

    /** La condición del producto de inventario, o null si todavía no la tiene. */
    public static function de(mixed $modelo): ?string
    {
        $valor = $modelo->condicion ?? null;

        return in_array($valor, self::VALORES, true) ? $valor : null;
    }
}
