<?php

namespace App\Services;

use App\Models\MovimientoPieza;
use App\Models\Pieza;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * El saldo de una pieza se mueve solo por acá.
 *
 * Dos razones. La primera es que el saldo y su historial tienen que cambiar juntos: si una venta
 * descuenta dos pantallas y nadie anota por qué, dentro de un mes nadie sabe si se vendieron, se
 * usaron en una reparación o se perdieron. La segunda es la carrera: dos ventas simultáneas de la
 * última pieza leerían «queda 1» las dos. Por eso todo pasa por `bloquear()`, que toma la fila con
 * `lockForUpdate` dentro de la transacción de quien llama.
 */
class StockDePiezas
{
    /**
     * Toma la pieza para modificarla, bloqueada hasta que termine la transacción.
     * Devuelve null si no existe (o si es de otra sucursal).
     */
    public static function bloquear(int $piezaId): ?Pieza
    {
        return Pieza::whereKey($piezaId)->lockForUpdate()->first();
    }

    /**
     * Saca unidades del stock. Si no alcanzan, no descuenta nada y lo dice.
     *
     * @param  string  $campoError  Bajo qué campo aparece el error en el formulario que llamó.
     */
    public static function descontar(
        Pieza $pieza,
        int $cantidad,
        string $tipo,
        ?Model $referencia = null,
        ?string $motivo = null,
        string $campoError = 'stock',
    ): MovimientoPieza {
        if ($cantidad < 1) {
            throw ValidationException::withMessages([
                $campoError => 'La cantidad de «' . $pieza->nombre . '» tiene que ser al menos 1.',
            ]);
        }

        if ($pieza->cantidad < $cantidad) {
            throw ValidationException::withMessages([
                $campoError => 'De «' . $pieza->nombre . '» ' . self::quedan($pieza->cantidad)
                    . ' y se están pidiendo ' . $cantidad . '.',
            ]);
        }

        return self::mover($pieza, -$cantidad, $tipo, $motivo, $referencia);
    }

    /** Devuelve unidades al stock: una venta que se corrigió, un trabajo que no se hizo. */
    public static function devolver(
        Pieza $pieza,
        int $cantidad,
        string $tipo = MovimientoPieza::DEVOLUCION,
        ?Model $referencia = null,
        ?string $motivo = null,
    ): ?MovimientoPieza {
        if ($cantidad < 1) {
            return null;
        }

        return self::mover($pieza, $cantidad, $tipo, $motivo, $referencia);
    }

    /** Entró mercadería: llegó un pedido, se despiezó un equipo. */
    public static function ingresar(Pieza $pieza, int $cantidad, ?string $motivo = null): ?MovimientoPieza
    {
        if ($cantidad < 1) {
            return null;
        }

        return self::mover($pieza, $cantidad, MovimientoPieza::INGRESO, $motivo);
    }

    /**
     * El conteo físico no coincide con el sistema: manda lo que se contó.
     * No hace nada si el saldo ya era ese.
     */
    public static function ajustar(Pieza $pieza, int $saldoContado, ?string $motivo = null): ?MovimientoPieza
    {
        $diferencia = max(0, $saldoContado) - $pieza->cantidad;

        if ($diferencia === 0) {
            return null;
        }

        return self::mover($pieza, $diferencia, MovimientoPieza::AJUSTE, $motivo);
    }

    /** El primer renglón del historial, cuando la pieza se crea con saldo. */
    public static function registrarAlta(Pieza $pieza, ?string $motivo = null): ?MovimientoPieza
    {
        if ($pieza->cantidad < 1) {
            return null;
        }

        // El saldo ya está guardado por el `create`: acá solo se anota de dónde salió.
        return MovimientoPieza::create([
            'pieza_id'    => $pieza->id,
            'sucursal_id' => $pieza->sucursal_id,
            'tipo'        => MovimientoPieza::ALTA,
            'cantidad'    => $pieza->cantidad,
            'saldo'       => $pieza->cantidad,
            'motivo'      => $motivo ?? $pieza->origen,
            'user_id'     => Auth::id(),
        ]);
    }

    /** Todo lo que sale o entra termina acá: cambia el saldo y deja el renglón. */
    private static function mover(
        Pieza $pieza,
        int $delta,
        string $tipo,
        ?string $motivo = null,
        ?Model $referencia = null,
    ): MovimientoPieza {
        $saldo = max(0, $pieza->cantidad + $delta);

        $pieza->forceFill(['cantidad' => $saldo])->save();

        return MovimientoPieza::create([
            'pieza_id'        => $pieza->id,
            'sucursal_id'     => $pieza->sucursal_id,
            'tipo'            => $tipo,
            'cantidad'        => $delta,
            'saldo'           => $saldo,
            'motivo'          => $motivo,
            'referencia_tipo' => $referencia ? class_basename($referencia) : null,
            'referencia_id'   => $referencia?->getKey(),
            'user_id'         => Auth::id(),
        ]);
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
