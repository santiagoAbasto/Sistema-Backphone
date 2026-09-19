<?php

namespace App\Services;

use App\Models\Secuencia;
use App\Models\Sucursal;
use App\Support\SucursalActiva;
use Illuminate\Support\Facades\DB;

/**
 * Los códigos de nota: CBA-V001, SUC-R014, CBA-ST007.
 *
 * Cada sucursal numera por su cuenta y lleva su prefijo adelante, así dos cajas que venden al mismo
 * tiempo en ciudades distintas nunca generan el mismo código. El contador se bloquea mientras se
 * incrementa (`lockForUpdate`), así que tampoco se repite dentro de una misma sucursal.
 */
class GeneradorCodigos
{
    /** clave interna => letra del documento */
    private const DOCUMENTOS = [
        'ventas'           => 'V',
        'reservas'         => 'R',
        'servicio_tecnico' => 'ST',
    ];

    private const RELLENO = 3;

    public static function siguienteVenta(?int $sucursalId = null): string
    {
        return self::previsualizar('ventas', $sucursalId);
    }

    public static function siguienteServicioTecnico(?int $sucursalId = null): string
    {
        return self::previsualizar('servicio_tecnico', $sucursalId);
    }

    public static function siguienteReserva(?int $sucursalId = null): string
    {
        return self::previsualizar('reservas', $sucursalId);
    }

    public static function crearVentaConCodigo(callable $callback, ?int $sucursalId = null): mixed
    {
        return self::crearConCodigo('ventas', $callback, $sucursalId);
    }

    public static function crearServicioTecnicoConCodigo(callable $callback, ?int $sucursalId = null): mixed
    {
        return self::crearConCodigo('servicio_tecnico', $callback, $sucursalId);
    }

    public static function crearReservaConCodigo(callable $callback, ?int $sucursalId = null): mixed
    {
        return self::crearConCodigo('reservas', $callback, $sucursalId);
    }

    /**
     * Deja el contador de una sucursal al menos en `$numero`.
     * Se usa al importar datos viejos: el próximo código sale después del último que ya existe.
     */
    public static function sincronizarSecuencia(string $clave, int $numero, ?int $sucursalId = null): void
    {
        if ($numero <= 0) {
            return;
        }

        $sucursalId ??= SucursalActiva::paraGuardar();

        DB::transaction(function () use ($clave, $numero, $sucursalId) {
            $seq = Secuencia::where('clave', $clave)
                ->where('sucursal_id', $sucursalId)
                ->lockForUpdate()
                ->first();

            if (! $seq) {
                Secuencia::create(['clave' => $clave, 'sucursal_id' => $sucursalId, 'ultimo_numero' => $numero]);

                return;
            }

            if ((int) $seq->ultimo_numero < $numero) {
                $seq->ultimo_numero = $numero;
                $seq->save();
            }
        });
    }

    /** El prefijo de la sucursal, o «GEN» si todavía no hay ninguna cargada. */
    public static function prefijoDe(?int $sucursalId): string
    {
        $prefijo = $sucursalId ? Sucursal::where('id', $sucursalId)->value('prefijo') : null;

        return $prefijo ?: 'GEN';
    }

    /** Cómo va a salir el próximo código, sin consumirlo. */
    private static function previsualizar(string $clave, ?int $sucursalId): string
    {
        $sucursalId ??= SucursalActiva::paraGuardar();

        $ultimo = (int) Secuencia::where('clave', $clave)
            ->where('sucursal_id', $sucursalId)
            ->value('ultimo_numero');

        return self::armar($clave, $sucursalId, $ultimo + 1);
    }

    private static function crearConCodigo(string $clave, callable $callback, ?int $sucursalId): mixed
    {
        $sucursalId ??= SucursalActiva::paraGuardar();

        return DB::transaction(function () use ($clave, $callback, $sucursalId) {
            // Se bloquea la fila del contador: no se duplica aunque diez personas vendan a la vez.
            $seq = Secuencia::where('clave', $clave)
                ->where('sucursal_id', $sucursalId)
                ->lockForUpdate()
                ->first();

            if (! $seq) {
                $seq = Secuencia::create(['clave' => $clave, 'sucursal_id' => $sucursalId, 'ultimo_numero' => 0]);
                $seq->refresh();
            }

            $seq->ultimo_numero = $seq->ultimo_numero + 1;
            $seq->save();

            return $callback(self::armar($clave, $sucursalId, (int) $seq->ultimo_numero));
        });
    }

    private static function armar(string $clave, ?int $sucursalId, int $numero): string
    {
        $documento = self::DOCUMENTOS[$clave] ?? 'X';

        return self::prefijoDe($sucursalId) . '-' . $documento . str_pad((string) $numero, self::RELLENO, '0', STR_PAD_LEFT);
    }
}
