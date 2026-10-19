<?php

namespace App\Services;

use App\Models\MovimientoPieza;
use App\Models\MovimientoProductoGeneral;
use App\Models\Pieza;
use App\Models\ProductoGeneral;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * El saldo de lo que se lleva por cantidad (piezas y productos generales) se mueve solo por acá.
 *
 * Dos razones. La primera es que el saldo y su historial tienen que cambiar juntos: si una venta
 * descuenta dos pantallas y nadie anota por qué, dentro de un mes nadie sabe si se vendieron, se
 * usaron en una reparación o se perdieron. La segunda es la carrera: dos ventas simultáneas de la
 * última unidad leerían «queda 1» las dos. Por eso todo pasa por `bloquear()`, que toma la fila con
 * `lockForUpdate` dentro de la transacción de quien llama.
 *
 * A un producto general, además, se le acomoda el estado con el saldo: disponible si queda alguno,
 * vendido si se agotó. Lo que está en permuta no se toca.
 */
class StockPorCantidad
{
    /**
     * Toma el producto para modificarlo, bloqueado hasta que termine la transacción.
     * Devuelve null si no existe (o si es de otra sucursal).
     *
     * @param  class-string<Pieza|ProductoGeneral>  $modelo
     */
    public static function bloquear(int $id, string $modelo = Pieza::class): Pieza|ProductoGeneral|null
    {
        return $modelo::whereKey($id)->lockForUpdate()->first();
    }

    /**
     * Saca unidades del stock. Si no alcanzan, no descuenta nada y lo dice.
     *
     * @param  string  $campoError  Bajo qué campo aparece el error en el formulario que llamó.
     */
    public static function descontar(
        Pieza|ProductoGeneral $item,
        int $cantidad,
        string $tipo,
        ?Model $referencia = null,
        ?string $motivo = null,
        string $campoError = 'stock',
    ): MovimientoPieza {
        if ($cantidad < 1) {
            throw ValidationException::withMessages([
                $campoError => 'La cantidad de «' . self::nombreDe($item) . '» tiene que ser al menos 1.',
            ]);
        }

        if ($item->cantidad < $cantidad) {
            throw ValidationException::withMessages([
                $campoError => 'De «' . self::nombreDe($item) . '» ' . self::quedan($item->cantidad)
                    . ' y se están pidiendo ' . $cantidad . '.',
            ]);
        }

        return self::mover($item, -$cantidad, $tipo, $motivo, $referencia);
    }

    /** Devuelve unidades al stock: una venta que se corrigió, un traspaso que se canceló. */
    public static function devolver(
        Pieza|ProductoGeneral $item,
        int $cantidad,
        string $tipo = MovimientoPieza::DEVOLUCION,
        ?Model $referencia = null,
        ?string $motivo = null,
    ): ?MovimientoPieza {
        if ($cantidad < 1) {
            return null;
        }

        return self::mover($item, $cantidad, $tipo, $motivo, $referencia);
    }

    /** Entró mercadería: llegó un pedido, se despiezó un equipo. */
    public static function ingresar(Pieza|ProductoGeneral $item, int $cantidad, ?string $motivo = null): ?MovimientoPieza
    {
        if ($cantidad < 1) {
            return null;
        }

        return self::mover($item, $cantidad, MovimientoPieza::INGRESO, $motivo);
    }

    /**
     * El conteo físico no coincide con el sistema: manda lo que se contó.
     * No hace nada si el saldo ya era ese.
     */
    public static function ajustar(Pieza|ProductoGeneral $item, int $saldoContado, ?string $motivo = null): ?MovimientoPieza
    {
        $diferencia = max(0, $saldoContado) - $item->cantidad;

        if ($diferencia === 0) {
            return null;
        }

        return self::mover($item, $diferencia, MovimientoPieza::AJUSTE, $motivo);
    }

    /** El primer renglón del historial, cuando el producto se crea con saldo. */
    public static function registrarAlta(Pieza|ProductoGeneral $item, ?string $motivo = null): ?MovimientoPieza
    {
        if ($item->cantidad < 1) {
            return null;
        }

        // El saldo ya está guardado por el `create`: acá solo se anota de dónde salió.
        return self::anotar($item, [
            'tipo'     => MovimientoPieza::ALTA,
            'cantidad' => $item->cantidad,
            'saldo'    => $item->cantidad,
            'motivo'   => $motivo ?? ($item instanceof Pieza ? $item->origen : $item->procedencia),
        ]);
    }

    /** Todo lo que sale o entra termina acá: cambia el saldo y deja el renglón. */
    private static function mover(
        Pieza|ProductoGeneral $item,
        int $delta,
        string $tipo,
        ?string $motivo = null,
        ?Model $referencia = null,
    ): MovimientoPieza {
        $saldo = max(0, $item->cantidad + $delta);
        $cambios = ['cantidad' => $saldo];

        if ($item instanceof ProductoGeneral
            && in_array($item->estado, [ProductoGeneral::ESTADO_DISPONIBLE, ProductoGeneral::ESTADO_VENDIDO], true)) {
            $cambios['estado'] = $saldo > 0 ? ProductoGeneral::ESTADO_DISPONIBLE : ProductoGeneral::ESTADO_VENDIDO;
        }

        $item->forceFill($cambios)->save();

        return self::anotar($item, [
            'tipo'            => $tipo,
            'cantidad'        => $delta,
            'saldo'           => $saldo,
            'motivo'          => $motivo,
            'referencia_tipo' => $referencia ? class_basename($referencia) : null,
            'referencia_id'   => $referencia?->getKey(),
        ]);
    }

    private static function anotar(Pieza|ProductoGeneral $item, array $renglon): MovimientoPieza
    {
        $renglon += ['sucursal_id' => $item->sucursal_id, 'user_id' => Auth::id()];

        return $item instanceof Pieza
            ? MovimientoPieza::create($renglon + ['pieza_id' => $item->id])
            : MovimientoProductoGeneral::create($renglon + ['producto_general_id' => $item->id]);
    }

    /** Cómo se nombra en un mensaje: a un vidrio no lo distingue el nombre solo, sino el modelo. */
    private static function nombreDe(Pieza|ProductoGeneral $item): string
    {
        return $item instanceof ProductoGeneral ? $item->etiqueta() : $item->nombre;
    }

    private static function quedan(int $cantidad): string
    {
        return match (true) {
            $cantidad <= 0 => 'no queda ninguna',
            $cantidad === 1 => 'queda 1',
            default => 'quedan ' . $cantidad,
        };
    }
}
