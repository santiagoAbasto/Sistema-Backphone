<?php

namespace App\Services;

use App\Models\Egreso;
use App\Models\Reserva;
use App\Models\ServicioTecnico;
use App\Models\Venta;
use Illuminate\Support\Facades\DB;

/**
 * Cuánto efectivo entró y salió del cajón de una sucursal entre dos fechas (ambas incluidas).
 *
 * Es la única cuenta de efectivo del sistema: la usan el cierre de caja y la tarjeta «Efectivo en
 * caja» del Resumen, así nunca dan números distintos.
 *
 * - Ventas en efectivo: lo cobrado menos la permuta (un equipo, no plata) y menos el abono de una
 *   reserva aplicada (esa plata entró el día que se reservó).
 * - Servicios en efectivo que no salieron de una venta (esos ya vienen en la venta).
 * - Abonos de reserva cobrados en efectivo, el día en que se dejaron.
 * - Egresos: salen todos del cajón, incluido el pago al técnico.
 *
 * Se compara por día (whereDate) y no con un rango de texto: unas fechas se guardan con hora y
 * otras sin, y «del 8 al 8» dejaba afuera lo guardado como «8 a las 00:00».
 */
final class EfectivoDeCaja
{
    /**
     * @return array{ventas: float, servicios: float, reservas: float, egresos: float, neto: float}
     */
    public static function movimientos(int $sucursalId, string $desde, string $hasta): array
    {
        $ventas = (float) Venta::query()
            ->where('sucursal_id', $sucursalId)
            ->where('metodo_pago', 'efectivo')
            ->whereDate('fecha', '>=', $desde)->whereDate('fecha', '<=', $hasta)
            ->sum(DB::raw('subtotal - COALESCE(valor_permuta, 0) - COALESCE(monto_reserva_aplicado, 0)'));

        $servicios = (float) ServicioTecnico::query()
            ->where('sucursal_id', $sucursalId)
            ->whereNull('venta_id')
            ->where('metodo_pago', 'efectivo')
            ->whereDate('fecha', '>=', $desde)->whereDate('fecha', '<=', $hasta)
            ->sum('precio_venta');

        $reservas = (float) Reserva::query()
            ->where('sucursal_id', $sucursalId)
            ->where('metodo_pago', 'efectivo')
            ->whereDate('fecha', '>=', $desde)->whereDate('fecha', '<=', $hasta)
            ->sum('monto_reserva');

        $egresos = (float) Egreso::query()
            ->where('sucursal_id', $sucursalId)
            ->whereDate('created_at', '>=', $desde)->whereDate('created_at', '<=', $hasta)
            ->sum('precio_invertido');

        return [
            'ventas'    => round($ventas, 2),
            'servicios' => round($servicios, 2),
            'reservas'  => round($reservas, 2),
            'egresos'   => round($egresos, 2),
            'neto'      => round($ventas + $servicios + $reservas - $egresos, 2),
        ];
    }
}
