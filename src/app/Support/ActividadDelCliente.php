<?php

namespace App\Support;

use App\Models\Cliente;
use App\Models\Cotizacion;
use App\Models\Reserva;
use App\Models\ServicioTecnico;
use App\Models\Venta;

/**
 * Movimientos de un cliente: sus ventas, reservas, servicios y cotizaciones.
 *
 * Ventas y reservas guardan el teléfono escrito a mano (no un enlace al cliente), así que se buscan
 * por sus últimos 8 dígitos. La usan la ficha del cliente del administrador y la del vendedor: el
 * vendedor solo ve lo que registró él, por eso se puede acotar con `$userId`.
 */
class ActividadDelCliente
{
    public static function de(Cliente $cliente, string $prefijo = 'admin', ?int $userId = null): array
    {
        $digitos  = preg_replace('/\D/', '', (string) $cliente->telefono);
        $telefono = strlen($digitos) >= 8 ? substr($digitos, -8) : null;

        $mio = fn ($q) => $userId ? $q->where('user_id', $userId) : $q;

        $ventas = $telefono
            ? $mio(Venta::where('telefono_cliente', 'like', "%{$telefono}%"))
                ->orderByDesc('fecha')->orderByDesc('id')
                ->get(['id', 'codigo_nota', 'fecha', 'subtotal', 'created_at'])
            : collect();

        $reservas = $telefono
            ? $mio(Reserva::where('telefono_cliente', 'like', "%{$telefono}%"))
                ->latest()
                ->get(['id', 'codigo_nota', 'subtotal', 'estado', 'created_at'])
            : collect();

        $servicios = $mio(ServicioTecnico::where('cliente_id', $cliente->id))
            ->latest()
            ->get(['id', 'codigo_nota', 'equipo', 'precio_venta', 'created_at']);

        $cotizaciones = $mio(Cotizacion::where('cliente_id', $cliente->id))
            ->latest()
            ->get(['id', 'total', 'drive_url', 'created_at']);

        $recientes = collect()
            ->concat($ventas->map(fn ($v) => [
                'tipo'    => 'venta',
                'titulo'  => 'Venta',
                'codigo'  => $v->codigo_nota,
                'fecha'   => $v->created_at,
                'monto'   => (float) $v->subtotal,
                'url'     => route("{$prefijo}.ventas.edit", $v->id),
                'externo' => false,
            ]))
            ->concat($servicios->map(fn ($s) => [
                'tipo'    => 'servicio',
                'titulo'  => 'Servicio técnico',
                'codigo'  => $s->codigo_nota,
                'detalle' => $s->equipo,
                'fecha'   => $s->created_at,
                'monto'   => (float) $s->precio_venta,
                'url'     => route("{$prefijo}.servicios.boleta", $s->id),
                'externo' => true,
            ]))
            ->concat($cotizaciones->map(fn ($c) => [
                'tipo'    => 'cotizacion',
                'titulo'  => 'Cotización',
                'codigo'  => 'COT-' . $c->id,
                'fecha'   => $c->created_at,
                'monto'   => (float) $c->total,
                'url'     => $c->drive_url ?: route("{$prefijo}.cotizaciones.pdf", $c->id),
                'externo' => true,
            ]))
            ->concat($reservas->map(fn ($r) => [
                'tipo'    => 'reserva',
                'titulo'  => 'Reserva',
                'codigo'  => $r->codigo_nota,
                'detalle' => ucfirst((string) $r->estado),
                'fecha'   => $r->created_at,
                'monto'   => (float) $r->subtotal,
                'url'     => route("{$prefijo}.reservas.boleta", $r->id),
                'externo' => true,
            ]))
            ->sortByDesc(fn ($m) => optional($m['fecha'])->timestamp)
            ->take(8)
            ->values();

        return [
            'ventas' => [
                'cantidad' => $ventas->count(),
                'total'    => round((float) $ventas->sum('subtotal'), 2),
                'ultima'   => optional($ventas->first())->fecha,
            ],
            'servicios'    => $servicios->count(),
            'cotizaciones' => $cotizaciones->count(),
            'reservas'     => $reservas->count(),
            'recientes'    => $recientes,
        ];
    }
}
