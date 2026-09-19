<?php

namespace App\Http\Controllers\Vendedor;

use App\Http\Controllers\Controller;
use App\Models\Cotizacion;
use App\Models\Reserva;
use App\Models\ServicioTecnico;
use App\Models\Venta;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Mi día: lo primero que ve el vendedor al entrar.
 *
 * Todo lo que muestra es del vendedor que está conectado (`user_id`); no se mezcla con lo de nadie más
 * ni con los gastos de la tienda, que son del administrador. La meta del mes la carga el administrador
 * en Sistema → Usuarios y roles; si no hay meta, la pantalla lo dice en vez de inventar una cifra.
 *
 * Acá no hay costo ni ganancia: el vendedor ve el precio, el descuento que hizo y lo que cobró.
 */
class DashboardVendedorController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $hoy  = now()->toDateString();

        $ventasHoy = Venta::with(['items'])
            ->where('user_id', $user->id)
            ->whereDate('fecha', $hoy)
            ->get();

        $serviciosHoy = ServicioTecnico::where('user_id', $user->id)
            ->whereDate('fecha', $hoy)
            ->get();

        $bruto = 0.0;     // el precio de los productos con el descuento que hizo el vendedor
        $cobrado = 0.0;    // lo que el cliente pagó hoy (sin la permuta ni la seña que ya había pagado)
        $descuentos = 0.0; // lo que el vendedor rebajó de su bolsillo del precio de lista

        foreach ($ventasHoy as $venta) {
            $brutoVenta = (float) $venta->items->sum(fn ($i) => (float) $i->precio_venta - (float) $i->descuento);

            // La permuta y la seña se descuentan una vez por venta, no una vez por producto
            $permuta = (float) ($venta->valor_permuta ?? 0);
            $sena    = (float) ($venta->monto_reserva_aplicado ?? 0);

            $bruto      += $brutoVenta;
            $cobrado    += max(0, $brutoVenta - $permuta - $sena);
            $descuentos += (float) $venta->items->sum(fn ($i) => (float) $i->descuento);
        }

        foreach ($serviciosHoy as $servicio) {
            $bruto   += (float) $servicio->precio_venta;
            $cobrado += (float) $servicio->precio_venta;
        }

        return Inertia::render('Vendedor/Dashboard', [
            'resumen' => [
                'ventas_dia'       => $ventasHoy->count(),
                'servicios_dia'    => $serviciosHoy->count(),
                'cotizaciones_dia' => Cotizacion::where('user_id', $user->id)->whereDate('created_at', $hoy)->count(),
                'reservas_activas' => Reserva::where('user_id', $user->id)->where('estado', 'activa')->count(),
                'bruto_dia'        => round($bruto, 2),
                'cobrado_dia'      => round($cobrado, 2),
                'descuentos_dia'   => round($descuentos, 2),
                'total_mes'        => round($this->totalDelMes($user->id), 2),
                'meta_mensual'     => $user->metaMensual(),
                'mes'              => now()->locale('es')->isoFormat('MMMM [de] YYYY'),
            ],

            // Los últimos 14 días del vendedor, para el gráfico mínimo de su tarjeta.
            'serie' => $this->ultimosCatorceDias($user->id),

            'ultimasVentas' => Venta::with('items')
                ->where('user_id', $user->id)
                ->latest('fecha')->latest('id')->take(5)->get()
                ->map(fn (Venta $v) => [
                    'id'     => $v->id,
                    'cliente' => $v->nombre_cliente,
                    'codigo' => $v->codigo_nota,
                    'total'  => round((float) $v->items->sum(fn ($i) => (float) $i->precio_venta - (float) $i->descuento), 2),
                    // `ventas.fecha` se guarda como texto: se normaliza acá para que la pantalla no tenga que adivinar
                    'fecha'  => $v->fecha ? Carbon::parse($v->fecha)->toDateString() : $v->created_at?->toDateString(),
                ])->values(),

            'ultimasCotizaciones' => Cotizacion::where('user_id', $user->id)
                ->latest()->take(5)->get()
                ->map(fn (Cotizacion $c) => [
                    'id'      => $c->id,
                    'cliente' => $c->nombre_cliente,
                    'total'   => round((float) $c->total, 2),
                    'fecha'   => $c->created_at?->toDateString(),
                ])->values(),

            'ultimosServicios' => ServicioTecnico::where('user_id', $user->id)
                ->latest('fecha')->latest('id')->take(5)->get()
                ->map(fn (ServicioTecnico $s) => [
                    'id'     => $s->id,
                    'equipo' => $s->equipo,
                    'cliente' => $s->cliente,
                    'total'  => round((float) $s->precio_venta, 2),
                    'fecha'  => optional($s->fecha)->toDateString() ?? $s->created_at?->toDateString(),
                ])->values(),
        ]);
    }

    /**
     * Lo vendido por día en las últimas dos semanas, con los días sin movimiento en cero.
     *
     * Se arma con dos consultas agrupadas (una de ventas y otra de servicios), no con una por día:
     * si no, entrar a la pantalla haría veintiocho viajes a la base.
     *
     * @return list<array{fecha: string, total: float}>
     */
    private function ultimosCatorceDias(int $userId): array
    {
        $desde = now()->subDays(13)->startOfDay();

        $ventas = Venta::with('items')
            ->where('user_id', $userId)
            ->whereDate('fecha', '>=', $desde->toDateString())
            ->get()
            ->groupBy(fn (Venta $v) => Carbon::parse($v->fecha ?? $v->created_at)->toDateString())
            ->map(fn ($grupo) => (float) $grupo->sum(
                fn (Venta $v) => $v->items->sum(fn ($i) => (float) $i->precio_venta - (float) $i->descuento)
            ));

        $servicios = ServicioTecnico::where('user_id', $userId)
            ->whereDate('fecha', '>=', $desde->toDateString())
            ->get()
            ->groupBy(fn (ServicioTecnico $s) => optional($s->fecha)->toDateString() ?? $s->created_at?->toDateString())
            ->map(fn ($grupo) => (float) $grupo->sum('precio_venta'));

        $dias = [];
        for ($cursor = $desde->copy(); $cursor->lte(now()); $cursor->addDay()) {
            $clave = $cursor->toDateString();
            $dias[] = [
                'fecha' => $clave,
                'total' => round((float) ($ventas[$clave] ?? 0) + (float) ($servicios[$clave] ?? 0), 2),
            ];
        }

        return $dias;
    }

    /** Ventas y servicios del mes en curso. Se filtra también por año: si no, se sumaría el mismo mes de otros años. */
    private function totalDelMes(int $userId): float
    {
        $mes  = now()->month;
        $anio = now()->year;

        $ventas = Venta::with('items')
            ->where('user_id', $userId)
            ->whereMonth('fecha', $mes)
            ->whereYear('fecha', $anio)
            ->get()
            ->sum(fn (Venta $v) => $v->items->sum(fn ($i) => (float) $i->precio_venta - (float) $i->descuento));

        $servicios = ServicioTecnico::where('user_id', $userId)
            ->whereMonth('fecha', $mes)
            ->whereYear('fecha', $anio)
            ->sum('precio_venta');

        return (float) $ventas + (float) $servicios;
    }
}
