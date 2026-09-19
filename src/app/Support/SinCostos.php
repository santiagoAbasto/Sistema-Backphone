<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Lo que el vendedor no tiene por qué ver: el costo de la tienda y la ganancia.
 *
 * El vendedor ve el precio, el descuento que él hizo y lo que cobró. El precio de costo, la ganancia
 * y la procedencia son del administrador, así que no se ocultan con CSS: no salen del servidor.
 *
 * Se usa en las listas del panel del vendedor, en la API de stock y en los PDF que él puede abrir.
 */
class SinCostos
{
    /** Campos que nunca viajan al panel del vendedor (el costo, y de un servicio técnico, quién y cuándo lo cargó). */
    public const OCULTOS = [
        'precio_costo', 'precio_invertido', 'ganancia_neta', 'procedencia',
        'costo_pendiente', 'costo_cargado_por', 'costo_cargado_en', 'quien_cargo_el_costo',
    ];

    /** ¿A esta persona hay que ocultarle los costos? Solo el administrador los ve. */
    public static function aplica(?object $usuario): bool
    {
        return ($usuario->rol ?? null) !== 'admin';
    }

    /** Quita los campos ocultos de un arreglo (y de sus `items`, si los tiene). */
    public static function deArreglo(array $fila): array
    {
        foreach (self::OCULTOS as $campo) {
            unset($fila[$campo]);
        }

        if (isset($fila['items']) && is_array($fila['items'])) {
            $fila['items'] = array_map([self::class, 'deArreglo'], $fila['items']);
        }

        return $fila;
    }

    /**
     * Quita los campos ocultos EN CUALQUIER NIVEL de anidación.
     *
     * `deArreglo` solo mira el primer nivel y los `items`; esto recorre relaciones anidadas
     * (venta.items.celular, reserva.items.computadora, etc.) para que el costo, la ganancia y
     * la procedencia no viajen al vendedor por ninguna rendija. Acepta un modelo, una colección
     * o un arreglo ya serializado y siempre devuelve arreglos listos para Inertia/JSON.
     */
    public static function purgar($valor)
    {
        if (is_object($valor) && method_exists($valor, 'toArray')) {
            $valor = $valor->toArray();
        }

        if (! is_array($valor)) {
            return $valor;
        }

        $limpio = [];
        foreach ($valor as $clave => $sub) {
            if (is_string($clave) && in_array($clave, self::OCULTOS, true)) {
                continue; // el costo/ganancia/procedencia no sale del servidor
            }

            // Recorre también modelos y colecciones anidadas (venta.items.celular, reservasActivas…)
            if (is_array($sub) || (is_object($sub) && method_exists($sub, 'toArray'))) {
                $limpio[$clave] = self::purgar($sub);
            } else {
                $limpio[$clave] = $sub;
            }
        }

        return $limpio;
    }

    /** Igual que `purgar` pero solo cuando la persona no es admin; el admin ve todo. */
    public static function paraUsuario($valor, ?object $usuario)
    {
        return self::aplica($usuario) ? self::purgar($valor) : (
            is_object($valor) && method_exists($valor, 'toArray') ? $valor->toArray() : $valor
        );
    }

    /** Lo mismo sobre una colección de modelos: devuelve arreglos listos para Inertia. */
    public static function deColeccion($modelos): Collection
    {
        return collect($modelos)->map(fn ($m) => self::deArreglo(is_array($m) ? $m : $m->toArray()))->values();
    }

    /**
     * El detalle de un servicio es un JSON con un renglón por trabajo, y cada renglón trae su costo.
     * Devuelve el mismo JSON con la descripción y lo que paga el cliente, sin el costo.
     */
    public static function detalleDeServicio(?string $json): ?string
    {
        $items = json_decode((string) $json, true);

        if (! is_array($items)) {
            return $json; // texto libre de los servicios viejos: no hay costos que sacar
        }

        $limpios = array_map(function ($item) {
            if (is_array($item)) {
                unset($item['costo']);
            }

            return $item;
        }, $items);

        return json_encode($limpios);
    }
}
