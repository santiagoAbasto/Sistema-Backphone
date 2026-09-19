<?php

namespace App\Http\Controllers\Automation;

use App\Http\Controllers\Controller;
use App\Models\Venta;
use App\Models\ServicioTecnico;
use App\Models\Egreso;
use Carbon\Carbon;
use Illuminate\Http\Request;

class TopProductsController extends Controller
{
    private function periodFacturacion(Carbon $start, Carbon $end): float
    {
        $ventas = Venta::with('items')
            ->whereBetween('fecha', [$start, $end])
            ->get();

        $facturacionVentas = (float) $ventas->sum(function ($venta) {
            return (float) $venta->items->sum('subtotal');
        });

        $facturacionServicios = (float) ServicioTecnico::whereBetween('fecha', [$start, $end])
            ->sum('precio_venta');

        return round($facturacionVentas + $facturacionServicios, 2);
    }

    private function topSummaryByField($items, string $field, int $limit = 5): array
    {
        return $items
            ->filter(fn ($item) => filled($item[$field] ?? null))
            ->groupBy($field)
            ->map(function ($group, $value) {
                return [
                    'valor' => (string) $value,
                    'unidades' => (int) $group->sum('cantidad'),
                    'ingresos' => round((float) $group->sum('subtotal'), 2),
                    'utilidad' => round((float) $group->sum('ganancia'), 2),
                ];
            })
            ->sortByDesc('unidades')
            ->take($limit)
            ->values()
            ->all();
    }

    private function topProfitabilityByField($items, string $field, int $limit = 5): array
    {
        return $items
            ->filter(fn ($item) => filled($item[$field] ?? null))
            ->groupBy($field)
            ->map(function ($group, $value) {
                $ingresos = (float) $group->sum('subtotal');
                $utilidad = (float) $group->sum('ganancia');

                return [
                    'valor' => (string) $value,
                    'unidades' => (int) $group->sum('cantidad'),
                    'ingresos' => round($ingresos, 2),
                    'utilidad' => round($utilidad, 2),
                    'margen_pct' => $ingresos > 0
                        ? round(($utilidad / $ingresos) * 100, 2)
                        : 0,
                ];
            })
            ->sortByDesc('utilidad')
            ->take($limit)
            ->values()
            ->all();
    }

    private function categoryLabel(string $categoria): string
    {
        return match ($categoria) {
            'celular' => 'celulares',
            'computadora' => 'computadoras',
            'producto_general' => 'productos_generales',
            'producto_apple' => 'productos_apple',
            'servicio_tecnico' => 'servicios_tecnicos',
            default => $categoria,
        };
    }

    public function __invoke(Request $request)
    {
        $fechaInicio = $request->input('fecha_inicio');
        $fechaFin = $request->input('fecha_fin');

        if ($fechaInicio && $fechaFin) {
            $startCurrent = Carbon::parse($fechaInicio)->startOfDay();
            $endCurrent = Carbon::parse($fechaFin)->endOfDay();
            $isCustomRange = true;
        } else {
            $primeraVenta = Venta::min('fecha');
            $primerServicio = ServicioTecnico::min('fecha');
            $primerEgreso = Egreso::min('created_at');

            $ultimaVenta = Venta::max('fecha');
            $ultimoServicio = ServicioTecnico::max('fecha');
            $ultimoEgreso = Egreso::max('created_at');

            $primerRegistro = collect([
                $primeraVenta,
                $primerServicio,
                $primerEgreso,
            ])->filter()->map(fn ($fecha) => Carbon::parse($fecha))->sort()->first();

            $ultimoRegistro = collect([
                $ultimaVenta,
                $ultimoServicio,
                $ultimoEgreso,
            ])->filter()->map(fn ($fecha) => Carbon::parse($fecha))->sortDesc()->first();

            $startCurrent = ($primerRegistro ?? now())->copy()->startOfDay();
            $endCurrent = ($ultimoRegistro ?? now())->copy()->endOfDay();
            $isCustomRange = false;
        }

        $periodDays = max(1, $startCurrent->diffInDays($endCurrent) + 1);
        $startPrevious = $startCurrent->copy()->subDays($periodDays);
        $endPrevious = $startCurrent->copy()->subDay()->endOfDay();

        /*
        |--------------------------------------------------------------------------
        | 1️⃣ VENTAS COMPLETAS (MISMA LÓGICA DASHBOARD)
        |--------------------------------------------------------------------------
        */
        $ventas = Venta::with([
            'items',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
        ])
        ->whereBetween('fecha', [$startCurrent, $endCurrent])
        ->get();

        $serviciosTecnicos = ServicioTecnico::whereBetween('fecha', [$startCurrent, $endCurrent])->get();

        $items = collect();

        /*
        |--------------------------------------------------------------------------
        | 2️⃣ PROCESAR VENTAS (CON PERMUTA CORRECTA)
        |--------------------------------------------------------------------------
        */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo ??
                optional($venta->entregadoComputadora)->precio_costo ??
                optional($venta->entregadoProductoGeneral)->precio_costo ??
                optional($venta->entregadoProductoApple)->precio_costo ??
                0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora', 'producto_apple']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta;

                $subtotal = $item->precio_venta - $item->descuento - $permuta;
                $ganancia = $subtotal - $item->precio_invertido;
                $categoriaBase = match ($item->tipo) {
                    'celular' => 'celular',
                    'computadora' => 'computadora',
                    'producto_general' => 'producto_general',
                    'producto_apple' => 'producto_apple',
                    default => (string) $item->tipo,
                };

                $detalleCategoria = match ($item->tipo) {
                    'celular' => 'celulares',
                    'computadora' => 'computadoras',
                    'producto_general' => (string) ($item->categoria ?: $item->productoGeneral?->tipo ?: 'producto_general'),
                    'producto_apple' => 'productos_apple',
                    default => (string) ($item->categoria ?: $item->tipo),
                };

                $nombreProducto = $item->nombre_producto
                    ?: match ($item->tipo) {
                        'celular' => $item->celular?->modelo,
                        'computadora' => $item->computadora?->nombre,
                        'producto_general' => $item->productoGeneral?->nombre,
                        'producto_apple' => $item->productoApple?->modelo,
                        default => null,
                    }
                    ?: 'Producto';

                $modeloProducto = $item->modelo
                    ?: match ($item->tipo) {
                        'celular' => $item->celular?->modelo,
                        'computadora' => $item->computadora?->nombre,
                        'producto_apple' => $item->productoApple?->modelo,
                        default => $nombreProducto,
                    };

                $items->push([
                    'categoria' => $categoriaBase,
                    'detalle_categoria' => $detalleCategoria,
                    'nombre'    => $nombreProducto,
                    'modelo'    => $modeloProducto,
                    'capacidad' => $item->capacidad,
                    'color'     => $item->color,
                    'bateria'   => $item->bateria,
                    'procesador'=> $item->procesador,
                    'ram'       => $item->ram,
                    'almacenamiento' => $item->almacenamiento,
                    'cantidad'  => (int) ($item->cantidad ?? 1),
                    'subtotal'  => (float) $subtotal,
                    'capital'   => (float) $item->precio_invertido,
                    'permuta'   => (float) $permuta,
                    'descuento' => (float) $item->descuento,
                    'ganancia'  => (float) $ganancia,
                    'ticket'    => (float) $item->precio_venta,
                ]);
            }
        }

        /*
        |--------------------------------------------------------------------------
        | 3️⃣ SERVICIOS TÉCNICOS REALES
        |--------------------------------------------------------------------------
        */
        foreach ($serviciosTecnicos as $servicio) {

            $subtotal = $servicio->precio_venta;
            $ganancia = $servicio->gananciaParaReportes();

            $items->push([
                'categoria' => 'servicio_tecnico',
                'nombre'    => 'Servicio Técnico',
                'modelo'    => null,
                'capacidad' => null,
                'color'     => null,
                'bateria'   => null,
                'procesador'=> null,
                'ram'       => null,
                'almacenamiento' => null,
                'cantidad'  => 1,
                'subtotal'  => (float) $subtotal,
                'capital'   => $servicio->costoParaReportes(),
                'permuta'   => 0,
                'descuento' => 0,
                'ganancia'  => (float) $ganancia,
                'costo_pendiente' => (bool) $servicio->costo_pendiente,
                'ticket'    => (float) $servicio->precio_venta,
            ]);
        }

        /*
        |--------------------------------------------------------------------------
        | 4️⃣ TOTALES FINANCIEROS
        |--------------------------------------------------------------------------
        */
        $facturacionTotal = $items->sum('subtotal');
        $capitalTotal     = $items->sum('capital');
        $permutaTotal     = $items->sum('permuta');
        $inversionTotal   = $capitalTotal + $permutaTotal;
        $utilidadBruta    = $items->sum('ganancia');

        /*
        |--------------------------------------------------------------------------
        | 5️⃣ EGRESOS DEL PERÍODO
        |--------------------------------------------------------------------------
        */
        $egresosTotal = Egreso::whereBetween('created_at', [
            $startCurrent->startOfDay(),
            $endCurrent->endOfDay()
        ])->sum('precio_invertido');

        $utilidadDisponible = $utilidadBruta - $egresosTotal;

        $ventasCount = $ventas->count();
        $serviciosCount = $serviciosTecnicos->count();
        $transaccionesCount = $ventasCount + $serviciosCount;
        $itemsVendidos = (int) $items->sum('cantidad');
        $descuentoTotal = (float) $items->sum('descuento');
        $ticketPromedioGlobal = $transaccionesCount > 0
            ? round($facturacionTotal / $transaccionesCount, 2)
            : 0;

        $topProductosRentables = $items
            ->where('categoria', '!=', 'servicio_tecnico')
            ->groupBy('nombre')
            ->map(function ($group, $nombre) {
                $ingresos = (float) $group->sum('subtotal');
                $utilidad = (float) $group->sum('ganancia');

                return [
                    'producto' => (string) $nombre,
                    'categoria' => $this->categoryLabel((string) $group->first()['categoria']),
                    'unidades' => (int) $group->sum('cantidad'),
                    'ingresos' => round($ingresos, 2),
                    'utilidad' => round($utilidad, 2),
                    'margen_pct' => $ingresos > 0 ? round(($utilidad / $ingresos) * 100, 2) : 0,
                ];
            })
            ->sortByDesc('utilidad')
            ->take(10)
            ->values();

        $topProductosRotacion = $items
            ->where('categoria', '!=', 'servicio_tecnico')
            ->groupBy('nombre')
            ->map(function ($group, $nombre) {
                return [
                    'producto' => (string) $nombre,
                    'categoria' => $this->categoryLabel((string) $group->first()['categoria']),
                    'unidades' => (int) $group->sum('cantidad'),
                    'ingresos' => round((float) $group->sum('subtotal'), 2),
                    'utilidad' => round((float) $group->sum('ganancia'), 2),
                ];
            })
            ->sortByDesc('unidades')
            ->take(10)
            ->values();

        /*
        |--------------------------------------------------------------------------
        | 6️⃣ RESUMEN POR CATEGORÍA
        |--------------------------------------------------------------------------
        */
        $resumenCategorias = $items
            ->groupBy('categoria')
            ->map(function ($group, $categoria) {

                $ingresos = $group->sum('subtotal');
                $utilidad = $group->sum('ganancia');

                return [
                    'categoria' => $categoria,
                    'ingresos'  => round($ingresos, 2),
                    'utilidad'  => round($utilidad, 2),
                    'margen_pct'=> $ingresos > 0
                        ? round(($utilidad / $ingresos) * 100, 2)
                        : 0,
                ];
            })
            ->values();

        $mixVentas = $resumenCategorias
            ->map(function ($categoria) use ($facturacionTotal, $utilidadBruta) {
                return [
                    'categoria' => $this->categoryLabel((string) $categoria['categoria']),
                    'participacion_ingresos_pct' => $facturacionTotal > 0
                        ? round(($categoria['ingresos'] / $facturacionTotal) * 100, 2)
                        : 0,
                    'participacion_utilidad_pct' => $utilidadBruta > 0
                        ? round(($categoria['utilidad'] / $utilidadBruta) * 100, 2)
                        : 0,
                ];
            })
            ->values();

        /*
        |--------------------------------------------------------------------------
        | 7️⃣ CATEGORÍA MÁS RENTABLE
        |--------------------------------------------------------------------------
        */
        $categoriaTop = $resumenCategorias
            ->sortByDesc('utilidad')
            ->first();

        /*
        |--------------------------------------------------------------------------
        | 8️⃣ CRECIMIENTO MENSUAL REAL
        |--------------------------------------------------------------------------
        */
        if ($isCustomRange) {
            $currentGrowthStart = $startCurrent->copy();
            $currentGrowthEnd = $endCurrent->copy();
            $previousGrowthStart = $startPrevious->copy();
            $previousGrowthEnd = $endPrevious->copy();
        } else {
            $anchorMonth = $endCurrent->copy();
            $currentGrowthStart = $anchorMonth->copy()->startOfMonth();
            $currentGrowthEnd = $anchorMonth->copy()->endOfMonth();
            $previousGrowthStart = $anchorMonth->copy()->subMonthNoOverflow()->startOfMonth();
            $previousGrowthEnd = $anchorMonth->copy()->subMonthNoOverflow()->endOfMonth();
        }

        $currentPeriodTotal = $this->periodFacturacion($currentGrowthStart, $currentGrowthEnd);
        $previousTotal = $this->periodFacturacion($previousGrowthStart, $previousGrowthEnd);

        $growth = $previousTotal > 0
            ? round((($currentPeriodTotal - $previousTotal) / $previousTotal) * 100, 2)
            : ($currentPeriodTotal > 0 ? 100.0 : 0.0);

        $periodo = $isCustomRange
            ? $startCurrent->format('Y-m-d') . ' a ' . $endCurrent->format('Y-m-d')
            : 'historico_total';

        $celularesItems = $items->where('categoria', 'celular')->values();
        $computadorasItems = $items->where('categoria', 'computadora')->values();
        $accesoriosItems = $items->where('categoria', 'producto_general')->values();
        $appleItems = $items->where('categoria', 'producto_apple')->values();
        $servicioItems = $items->where('categoria', 'servicio_tecnico')->values();

        $analisisCelulares = [
            'unidades_vendidas' => (int) $celularesItems->sum('cantidad'),
            'ingresos_totales' => round((float) $celularesItems->sum('subtotal'), 2),
            'utilidad_total' => round((float) $celularesItems->sum('ganancia'), 2),
            'ticket_promedio' => $celularesItems->count() > 0
                ? round((float) $celularesItems->avg('ticket'), 2)
                : 0,
            'descuento_promedio' => $celularesItems->count() > 0
                ? round((float) $celularesItems->avg('descuento'), 2)
                : 0,
            'color_mas_vendido' => $this->topSummaryByField($celularesItems, 'color', 1)[0] ?? null,
            'capacidad_mas_vendida' => $this->topSummaryByField($celularesItems, 'capacidad', 1)[0] ?? null,
            'bateria_promedio_vendida' => round((float) $celularesItems->filter(fn ($item) => filled($item['bateria']))->avg('bateria'), 2),
            'modelos_mas_rentables' => $this->topProfitabilityByField($celularesItems, 'modelo'),
            'modelos_mayor_rotacion' => $this->topSummaryByField($celularesItems, 'modelo'),
            'colores_mas_vendidos' => $this->topSummaryByField($celularesItems, 'color'),
            'capacidades_mas_vendidas' => $this->topSummaryByField($celularesItems, 'capacidad'),
        ];

        $configuracionesComputadoras = $computadorasItems->map(function ($item) {
            return array_merge($item, [
                'configuracion' => trim(collect([
                    $item['procesador'] ?? null,
                    $item['ram'] ? $item['ram'] . ' RAM' : null,
                    $item['almacenamiento'] ? $item['almacenamiento'] . ' SSD/HDD' : null,
                ])->filter()->implode(' / ')),
            ]);
        })->values();

        $analisisComputadoras = [
            'unidades_vendidas' => (int) $computadorasItems->sum('cantidad'),
            'ingresos_totales' => round((float) $computadorasItems->sum('subtotal'), 2),
            'utilidad_total' => round((float) $computadorasItems->sum('ganancia'), 2),
            'ticket_promedio' => $computadorasItems->count() > 0
                ? round((float) $computadorasItems->avg('ticket'), 2)
                : 0,
            'descuento_promedio' => $computadorasItems->count() > 0
                ? round((float) $computadorasItems->avg('descuento'), 2)
                : 0,
            'ram_mas_vendida' => $this->topSummaryByField($computadorasItems, 'ram', 1)[0] ?? null,
            'procesador_mas_vendido' => $this->topSummaryByField($computadorasItems, 'procesador', 1)[0] ?? null,
            'almacenamiento_mas_vendido' => $this->topSummaryByField($computadorasItems, 'almacenamiento', 1)[0] ?? null,
            'configuracion_mas_rentable' => $this->topProfitabilityByField($configuracionesComputadoras, 'configuracion', 1)[0] ?? null,
            'configuraciones_mas_rentables' => $this->topProfitabilityByField($configuracionesComputadoras, 'configuracion'),
            'configuraciones_mayor_rotacion' => $this->topSummaryByField($configuracionesComputadoras, 'configuracion'),
        ];

        $analisisAccesorios = [
            'unidades_vendidas' => (int) $accesoriosItems->sum('cantidad'),
            'ingresos_totales' => round((float) $accesoriosItems->sum('subtotal'), 2),
            'utilidad_total' => round((float) $accesoriosItems->sum('ganancia'), 2),
            'ticket_promedio' => $accesoriosItems->count() > 0
                ? round((float) $accesoriosItems->avg('ticket'), 2)
                : 0,
            'tipo_mas_vendido' => $this->topSummaryByField($accesoriosItems, 'detalle_categoria', 1)[0] ?? null,
            'producto_mejor_margen' => $topProductosRentables
                ->first(fn ($producto) => $producto['categoria'] === 'productos_generales'),
            'producto_mayor_rotacion' => $topProductosRotacion
                ->first(fn ($producto) => $producto['categoria'] === 'productos_generales'),
            'margen_promedio_accesorios' => $accesoriosItems->sum('subtotal') > 0
                ? round(($accesoriosItems->sum('ganancia') / $accesoriosItems->sum('subtotal')) * 100, 2)
                : 0,
            'tipos_mas_vendidos' => $this->topSummaryByField($accesoriosItems, 'detalle_categoria'),
            'productos_mas_rentables' => $topProductosRentables
                ->where('categoria', 'productos_generales')
                ->take(5)
                ->values(),
            'productos_mayor_rotacion' => $topProductosRotacion
                ->where('categoria', 'productos_generales')
                ->take(5)
                ->values(),
        ];

        $analisisApple = [
            'unidades_vendidas' => (int) $appleItems->sum('cantidad'),
            'ingresos_totales' => round((float) $appleItems->sum('subtotal'), 2),
            'utilidad_total' => round((float) $appleItems->sum('ganancia'), 2),
            'ticket_promedio' => $appleItems->count() > 0
                ? round((float) $appleItems->avg('ticket'), 2)
                : 0,
            'modelos_mas_rentables' => $this->topProfitabilityByField($appleItems, 'modelo'),
            'modelos_mayor_rotacion' => $this->topSummaryByField($appleItems, 'modelo'),
            'capacidades_mas_vendidas' => $this->topSummaryByField($appleItems, 'capacidad'),
        ];

        $analisisServicios = [
            'servicios_realizados' => (int) $servicioItems->count(),
            'ingresos_totales' => round((float) $servicioItems->sum('subtotal'), 2),
            'utilidad_total' => round((float) $servicioItems->sum('ganancia'), 2),
            'ticket_promedio' => $servicioItems->count() > 0
                ? round((float) $servicioItems->avg('ticket'), 2)
                : 0,
            'margen_promedio_pct' => $servicioItems->sum('subtotal') > 0
                ? round(($servicioItems->sum('ganancia') / $servicioItems->sum('subtotal')) * 100, 2)
                : 0,
        ];

        /*
        |--------------------------------------------------------------------------
        | RESPUESTA FINAL COMPLETA
        |--------------------------------------------------------------------------
        */
        return response()->json([
            'periodo'                    => $periodo,
            'period_start'               => $startCurrent->toDateString(),
            'period_end'                 => $endCurrent->toDateString(),
            'rango_personalizado'        => $isCustomRange,

            // Totales
            'facturacion_total'          => round($facturacionTotal, 2),
            'capital_total'              => round($capitalTotal, 2),
            'permuta_total'              => round($permutaTotal, 2),
            'inversion_total'            => round($inversionTotal, 2),
            'descuento_total'            => round($descuentoTotal, 2),

            // Utilidades
            'utilidad_bruta'             => round($utilidadBruta, 2),
            'egresos_total'              => round($egresosTotal, 2),
            'utilidad_disponible'        => round($utilidadDisponible, 2),

            // Márgenes
            'margen_global_pct'          => $facturacionTotal > 0
                ? round(($utilidadBruta / $facturacionTotal) * 100, 2)
                : 0,

            'crecimiento_mensual_pct'    => $growth,

            // Categorías
            'categoria_mas_rentable'     => $categoriaTop,
            'resumen_categorias'         => $resumenCategorias,
            'mix_ventas_categorias'      => $mixVentas,

            // KPI de decisión
            'kpis_comerciales' => [
                'ventas_registradas' => $ventasCount,
                'servicios_registrados' => $serviciosCount,
                'transacciones_totales' => $transaccionesCount,
                'items_vendidos' => $itemsVendidos,
                'ticket_promedio_global' => $ticketPromedioGlobal,
                'descuento_total' => round($descuentoTotal, 2),
                'porcentaje_descuento_sobre_facturacion' => $facturacionTotal > 0
                    ? round(($descuentoTotal / $facturacionTotal) * 100, 2)
                    : 0,
            ],

            // Ranking de productos
            'top_productos_rentables' => $topProductosRentables,
            'top_productos_mayor_rotacion' => $topProductosRotacion,

            // Analítica detallada
            'analisis_celulares' => $analisisCelulares,
            'analisis_computadoras' => $analisisComputadoras,
            'analisis_accesorios' => $analisisAccesorios,
            'analisis_productos_apple' => $analisisApple,
            'analisis_servicios_tecnicos' => $analisisServicios,
        ]);
    }
}
