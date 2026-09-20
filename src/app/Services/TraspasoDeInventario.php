<?php

namespace App\Services;

use App\Models\MovimientoPieza;
use App\Models\Pieza;
use App\Models\Traspaso;
use App\Models\TraspasoItem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Mover inventario de una sucursal a la otra.
 *
 * Un traspaso pasa por tres momentos y en ninguno el producto queda en el aire:
 *
 * - **Sale.** El equipo queda «en tránsito»: sigue siendo de la sucursal que lo envió, pero no se
 *   puede vender en ninguna de las dos. Las piezas se descuentan del saldo del origen, porque van
 *   en el paquete.
 * - **Llega.** Recién ahí cambia de dueño y vuelve a estar disponible, ya en la sucursal destino.
 * - **Se cancela.** Todo vuelve como estaba, sin haber salido nunca del origen.
 */
class TraspasoDeInventario
{
    /** Prepara el remito y saca lo enviado de la venta. Devuelve el traspaso ya creado. */
    public static function enviar(int $origenId, int $destinoId, array $items, ?string $nota = null): Traspaso
    {
        if ($origenId === $destinoId) {
            throw ValidationException::withMessages([
                'destino_sucursal_id' => 'El origen y el destino tienen que ser sucursales distintas.',
            ]);
        }

        if ($items === []) {
            throw ValidationException::withMessages([
                'items' => 'Elige al menos un producto para enviar.',
            ]);
        }

        return DB::transaction(function () use ($origenId, $destinoId, $items, $nota) {
            $preparados = [];

            foreach (array_values($items) as $indice => $item) {
                $preparados[] = self::prepararItem($origenId, (string) ($item['tipo'] ?? ''), (int) ($item['producto_id'] ?? 0), (int) ($item['cantidad'] ?? 1), $indice);
            }

            $traspaso = null;

            GeneradorCodigos::crearTraspasoConCodigo(function (string $codigo) use (&$traspaso, $origenId, $destinoId, $nota) {
                $traspaso = Traspaso::create([
                    'codigo'              => $codigo,
                    'origen_sucursal_id'  => $origenId,
                    'destino_sucursal_id' => $destinoId,
                    'estado'              => Traspaso::EN_TRANSITO,
                    'nota'                => $nota,
                    'enviado_por'         => Auth::id(),
                    'enviado_en'          => now(),
                ]);
            }, $origenId);

            foreach ($preparados as $item) {
                $traspaso->items()->create([
                    'tipo'        => $item['tipo'],
                    'producto_id' => $item['producto']->getKey(),
                    'cantidad'    => $item['cantidad'],
                    'nombre'      => $item['nombre'],
                    'detalle'     => $item['detalle'],
                ]);

                self::sacarDeLaVenta($item, $traspaso);
            }

            return $traspaso->load('items');
        });
    }

    /** Llegó: cambia de dueño y vuelve a estar disponible, ya en la sucursal destino. */
    public static function recibir(Traspaso $traspaso): void
    {
        if (! $traspaso->estaEnTransito()) {
            throw ValidationException::withMessages([
                'traspaso' => 'Este traspaso ya se cerró.',
            ]);
        }

        DB::transaction(function () use ($traspaso) {
            foreach ($traspaso->items as $item) {
                if ($item->tipo === 'pieza') {
                    self::entregarPieza($item, $traspaso);

                    continue;
                }

                $producto = $item->producto();

                if (! $producto) {
                    continue; // se borró en el camino: el renglón del remito queda igual
                }

                $producto->forceFill([
                    'sucursal_id' => $traspaso->destino_sucursal_id,
                    'estado'      => 'disponible',
                ])->save();
            }

            $traspaso->update([
                'estado'       => Traspaso::RECIBIDO,
                'recibido_por' => Auth::id(),
                'recibido_en'  => now(),
            ]);
        });
    }

    /** Se canceló antes de llegar: todo vuelve a estar disponible en la sucursal que lo envió. */
    public static function cancelar(Traspaso $traspaso): void
    {
        if (! $traspaso->estaEnTransito()) {
            throw ValidationException::withMessages([
                'traspaso' => 'Este traspaso ya se cerró.',
            ]);
        }

        DB::transaction(function () use ($traspaso) {
            foreach ($traspaso->items as $item) {
                if ($item->tipo === 'pieza') {
                    if ($pieza = StockDePiezas::bloquear($item->producto_id)) {
                        StockDePiezas::devolver($pieza, $item->cantidad, MovimientoPieza::ENTRADA_TRASPASO, $traspaso, 'Traspaso ' . $traspaso->codigo . ' cancelado');
                    }

                    continue;
                }

                $producto = $item->producto();

                if ($producto && $producto->estado === Traspaso::ESTADO_EQUIPO_EN_VIAJE) {
                    $producto->forceFill(['estado' => 'disponible'])->save();
                }
            }

            $traspaso->update(['estado' => Traspaso::CANCELADO]);
        });
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    /** Comprueba que el producto exista, sea del origen y esté disponible; arma su foto para el remito. */
    private static function prepararItem(int $origenId, string $tipo, int $productoId, int $cantidad, int $indice): array
    {
        $modelo = Traspaso::TIPOS[$tipo]['modelo'] ?? null;

        if (! $modelo) {
            throw ValidationException::withMessages(["items.$indice.tipo" => 'Tipo de producto inválido.']);
        }

        // Sin el filtro de sucursal a propósito: el super administrador mueve inventario de una
        // sucursal que puede no ser la que tiene elegida en el encabezado.
        $producto = $modelo::withoutGlobalScope('sucursal')
            ->whereKey($productoId)
            ->where('sucursal_id', $origenId)
            ->lockForUpdate()
            ->first();

        if (! $producto) {
            throw ValidationException::withMessages([
                "items.$indice.producto_id" => 'Uno de los productos ya no está en la sucursal de origen.',
            ]);
        }

        $cantidad = max(1, $cantidad);

        if ($tipo === 'pieza') {
            if ($producto->cantidad < $cantidad) {
                throw ValidationException::withMessages([
                    "items.$indice.cantidad" => 'De «' . $producto->nombre . '» quedan ' . $producto->cantidad . ' y se están enviando ' . $cantidad . '.',
                ]);
            }
        } else {
            $cantidad = 1;

            if ($producto->estado !== 'disponible') {
                throw ValidationException::withMessages([
                    "items.$indice.producto_id" => '«' . self::nombreDe($tipo, $producto) . '» no está disponible: no se puede enviar.',
                ]);
            }
        }

        return [
            'tipo'     => $tipo,
            'producto' => $producto,
            'cantidad' => $cantidad,
            'nombre'   => self::nombreDe($tipo, $producto),
            'detalle'  => self::detalleDe($tipo, $producto),
        ];
    }

    /** Lo enviado deja de poder venderse en las dos sucursales mientras viaja. */
    private static function sacarDeLaVenta(array $item, Traspaso $traspaso): void
    {
        if ($item['tipo'] === 'pieza') {
            StockDePiezas::descontar(
                $item['producto'],
                $item['cantidad'],
                MovimientoPieza::SALIDA_TRASPASO,
                $traspaso,
                'Traspaso ' . $traspaso->codigo . ' a ' . $traspaso->destino->nombre,
                'items',
            );

            return;
        }

        $item['producto']->forceFill(['estado' => Traspaso::ESTADO_EQUIPO_EN_VIAJE])->save();
    }

    /**
     * La pieza que llega se suma a la misma pieza del destino, si ya la tenían.
     *
     * Se busca por nombre y compatibilidad: si Sucre ya tiene «Pantalla incell · iPhone 11», las
     * unidades entran en esa ficha en vez de abrir una segunda con el mismo nombre. Si no la
     * tienen, se le copia la ficha del origen y entra con las unidades que llegaron.
     */
    private static function entregarPieza(TraspasoItem $item, Traspaso $traspaso): void
    {
        $origen = Pieza::withoutGlobalScope('sucursal')->find($item->producto_id);

        if (! $origen) {
            return;
        }

        $destino = Pieza::withoutGlobalScope('sucursal')
            ->where('sucursal_id', $traspaso->destino_sucursal_id)
            ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($origen->nombre)])
            ->whereRaw('LOWER(COALESCE(compatibilidad, \'\')) = ?', [mb_strtolower((string) $origen->compatibilidad)])
            ->lockForUpdate()
            ->first();

        if (! $destino) {
            $destino = Pieza::withoutGlobalScope('sucursal')->create([
                'sucursal_id'    => $traspaso->destino_sucursal_id,
                'nombre'         => $origen->nombre,
                'categoria'      => $origen->categoria,
                'compatibilidad' => $origen->compatibilidad,
                'origen'         => 'Traspaso desde ' . $traspaso->origen->nombre,
                'minimo'         => $origen->minimo,
                'precio_costo'   => $origen->precio_costo,
                'precio_venta'   => $origen->precio_venta,
                // El código es único por sucursal, pero copiarlo invita a confusión: el destino
                // le pone el suyo si lo necesita.
                'codigo'         => null,
                'cantidad'       => 0,
            ]);
        }

        StockDePiezas::devolver(
            $destino,
            $item->cantidad,
            MovimientoPieza::ENTRADA_TRASPASO,
            $traspaso,
            'Traspaso ' . $traspaso->codigo . ' desde ' . $traspaso->origen->nombre,
        );
    }

    private static function nombreDe(string $tipo, Model $producto): string
    {
        return match ($tipo) {
            'celular', 'producto_apple' => (string) $producto->modelo,
            default                     => (string) $producto->nombre,
        };
    }

    private static function detalleDe(string $tipo, Model $producto): ?string
    {
        $partes = match ($tipo) {
            'celular', 'producto_apple' => [$producto->capacidad, $producto->color, $producto->imei_1],
            'computadora'               => [$producto->procesador, $producto->ram, $producto->numero_serie],
            'producto_general'          => [$producto->tipo, $producto->codigo],
            'pieza'                     => [$producto->categoria, $producto->compatibilidad],
            default                     => [],
        };

        return implode(' · ', array_filter(array_map('trim', array_map('strval', $partes)))) ?: null;
    }
}
