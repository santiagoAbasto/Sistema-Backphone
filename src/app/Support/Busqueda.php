<?php

namespace App\Support;

/**
 * Buscar texto sin depender del motor de base de datos.
 *
 * `ILIKE` solo existe en PostgreSQL: en SQLite (donde corren los tests) la consulta revienta.
 * `LOWER(columna) LIKE ?` funciona igual en los dos, siempre que el texto buscado también
 * venga en minúsculas y con los comodines escapados.
 */
class Busqueda
{
    /** Texto listo para un `LIKE`: en minúsculas y con `%`, `_` y `\` escapados. */
    public static function escapar(string $q): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], mb_strtolower(trim($q)));
    }

    /** El patrón completo «%texto%» para buscar en cualquier parte de la columna. */
    public static function contiene(string $q): string
    {
        return '%' . static::escapar($q) . '%';
    }
}
