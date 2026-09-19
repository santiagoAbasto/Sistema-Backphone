<?php

namespace App\Http\Controllers;

use App\Models\Venta;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoGeneral;
use App\Models\ServicioTecnico;

use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;


class ReporteController extends Controller
{
    /** Tipos de movimiento tal como aparecen en el reporte. */
    private const TIPOS = ['Celular', 'Computadora', 'Producto General', 'Producto Apple', 'Servicio Técnico'];

    public function index(Request $request)
    {
        $request->validate([
            'fecha_inicio' => 'nullable|date',
            'fecha_fin'    => 'nullable|date|after_or_equal:fecha_inicio',
            'vendedor_id'  => 'nullable|exists:users,id',
            'tipo'         => ['nullable', Rule::in(self::TIPOS)],
            'buscar'       => 'nullable|string|max:100',
            'por_pagina'   => 'nullable|in:25,50,100',
            'page'         => 'nullable|integer|min:1',
        ], [
            'fecha_fin.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.',
        ]);

        /* =====================================================
     * VENTAS
     * ===================================================== */
        $ventas = Venta::with([
            'vendedor',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'servicioTecnico',
        ])
            ->when(
                $request->filled('vendedor_id'),
                fn($q) =>
                $q->where('user_id', $request->vendedor_id)
            )
            ->when(
                $request->filled('fecha_inicio') && $request->filled('fecha_fin'),
                fn($q) => $q->whereBetween('fecha', [
                    $request->fecha_inicio,
                    $request->fecha_fin
                ])
            )
            ->orderBy('created_at') // orden real por hora
            ->get();


        /* =====================================================
     * SERVICIOS TÉCNICOS
     * ===================================================== */
        $serviciosTecnicos = ServicioTecnico::with('vendedor')
            ->when(
                $request->filled('vendedor_id'),
                fn($q) =>
                $q->where('user_id', $request->vendedor_id)
            )
            ->when(
                $request->filled('fecha_inicio') && $request->filled('fecha_fin'),
                fn($q) => $q->whereBetween('fecha', [
                    $request->fecha_inicio,
                    $request->fecha_fin
                ])
            )
            ->orderBy('created_at')
            ->get();


        $items = collect();

        $gananciasPorTipo = [
            'celulares'        => 0,
            'computadoras'     => 0,
            'generales'        => 0,
            'productos_apple'  => 0,
            'servicio_tecnico' => 0,
        ];

        $mapTipo = [
            'Celular'          => 'celulares',
            'Computadora'      => 'computadoras',
            'Producto General' => 'generales',
            'Producto Apple'   => 'productos_apple',
        ];

        $inversionTotal = 0;


        /* =====================================================
     * PROCESAR VENTAS
     * ===================================================== */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo
                ?? optional($venta->entregadoComputadora)->precio_costo
                ?? optional($venta->entregadoProductoGeneral)->precio_costo
                ?? optional($venta->entregadoProductoApple)->precio_costo
                ?? 0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta ?: $permutaAplicada;

                $tipoProducto = match ($item->tipo) {
                    'celular'          => 'Celular',
                    'computadora'      => 'Computadora',
                    'producto_general' => 'Producto General',
                    'producto_apple'   => 'Producto Apple',
                    default            => '—',
                };

                $nombreProducto = match ($item->tipo) {
                    'celular'          => $item->celular?->modelo ?? '—',
                    'computadora'      => $item->computadora?->nombre ?? '—',
                    'producto_general' => $item->productoGeneral?->nombre ?? '—',
                    'producto_apple'   => $item->productoApple?->modelo ?? '—',
                    default            => '—',
                };

                $ganancia = $item->precio_venta - $item->descuento - $permuta - $item->precio_invertido;

                $inversionTotal += $item->precio_invertido;

                if (isset($mapTipo[$tipoProducto])) {
                    $gananciasPorTipo[$mapTipo[$tipoProducto]] += $ganancia;
                }

                $items->push([
                    'fecha'     => $venta->created_at, // usar hora real
                    'producto'  => $nombreProducto,
                    'tipo'      => $tipoProducto,
                    'subtotal'  => $item->subtotal,
                    'ganancia'  => $ganancia,
                    'descuento' => $item->descuento,
                    'permuta'   => $permuta,
                    'capital'   => $item->precio_invertido,
                    'vendedor'  => $venta->vendedor?->name,
                    'codigo'    => $venta->codigo_nota,
                ]);
            }
        }


        /* =====================================================
     * SERVICIOS TÉCNICOS
     * ===================================================== */
        foreach ($serviciosTecnicos as $servicio) {

            $ganancia = $servicio->gananciaParaReportes();

            $gananciasPorTipo['servicio_tecnico'] += $ganancia;
            $inversionTotal += $servicio->costoParaReportes();

            $items->push([
                'fecha'     => $servicio->created_at,
                'producto'  => 'Servicio Técnico',
                'tipo'      => 'Servicio Técnico',
                'subtotal'  => $servicio->precio_venta,
                'ganancia'  => $ganancia,
                'costo_pendiente' => (bool) $servicio->costo_pendiente,
                'descuento' => 0,
                'permuta'   => 0,
                'capital'   => $servicio->costoParaReportes(),
                'vendedor'  => $servicio->vendedor?->name,
                'codigo'    => $servicio->codigo_nota ?? '—',
            ]);
        }


        /* =====================================================
     * ORDEN FINAL POR FECHA Y HORA
     * ===================================================== */
        $items = $items
            ->sortBy(fn($i) => Carbon::parse($i['fecha'])->timestamp)
            ->values();


        /* =====================================================
     * RESUMEN
     * ===================================================== */
        $resumen = [
            'total_ventas'       => $items->sum('subtotal'),
            'total_ganancia'     => $items->sum('ganancia'),
            'total_descuento'    => $items->sum('descuento'),
            'total_permuta'      => $items->sum('permuta'),
            'total_inversion'    => $inversionTotal,
            'movimientos'        => $items->count(),
            'ganancias_por_tipo' => $gananciasPorTipo,
            'ganancia_servicio'  => $gananciasPorTipo['servicio_tecnico'],
            // Servicios técnicos sin costo cargado: su utilidad no está sumada hasta que el administrador lo cargue
            'servicios_sin_costo' => $serviciosTecnicos->where('costo_pendiente', true)->count(),
            'ganancia_liquida'   => $items
                ->where('tipo', '!=', 'Servicio Técnico')
                ->sum('ganancia'),
        ];


        /* =====================================================
     * TENDENCIA POR CATEGORÍA (por día hasta 62 días; si no, por mes)
     * ===================================================== */
        $porDia = $request->filled('fecha_inicio') && $request->filled('fecha_fin')
            && Carbon::parse($request->fecha_inicio)->diffInDays(Carbon::parse($request->fecha_fin)) <= 62;
        $formatoClave = $porDia ? 'Y-m-d' : 'Y-m';
        $etiquetasSerie = [
            'Celular'          => 'Celulares',
            'Computadora'      => 'Computadoras',
            'Producto General' => 'Productos Generales',
            'Producto Apple'   => 'Equipos de marca',
            'Servicio Técnico' => 'Servicios Técnicos',
        ];

        $serie = [
            'granularidad' => $porDia ? 'dia' : 'mes',
            'puntos' => $items
                ->groupBy(fn($i) => Carbon::parse($i['fecha'])->format($formatoClave))
                ->sortKeys()
                ->map(fn($g, $clave) => [
                    'clave' => $clave,
                    'categorias' => collect($etiquetasSerie)
                        ->mapWithKeys(fn($label, $tipo) => [$label => round($g->where('tipo', $tipo)->sum('ganancia'), 2)])
                        ->all(),
                ])
                ->values(),
        ];


        /* =====================================================
     * RENDIMIENTO POR VENDEDOR
     * ===================================================== */
        $porVendedor = $items
            ->groupBy(fn($i) => $i['vendedor'] ?? 'Sin vendedor')
            ->map(fn($g, $nombre) => [
                'nombre'      => $nombre,
                'movimientos' => $g->count(),
                'vendido'     => round($g->sum('subtotal'), 2),
                'ganancia'    => round($g->sum('ganancia'), 2),
            ])
            ->sortByDesc('vendido')
            ->values();


        /* =====================================================
     * DETALLE: lo más reciente primero, con tipo y búsqueda, paginado
     * (el resumen de arriba siempre cuenta todo el período)
     * ===================================================== */
        $detalle = $items
            ->sortByDesc(fn($i) => Carbon::parse($i['fecha'])->timestamp)
            ->when($request->filled('tipo'), fn($c) => $c->where('tipo', $request->tipo))
            ->when($request->filled('buscar'), function ($c) use ($request) {
                $texto = Str::lower(Str::ascii($request->buscar));

                return $c->filter(fn($i) => Str::contains(
                    Str::lower(Str::ascii(implode(' ', [$i['producto'], $i['codigo'], $i['vendedor'], $i['tipo']]))),
                    $texto
                ));
            })
            ->values();

        $porPagina = (int) $request->input('por_pagina', 25);
        $ultimaPagina = max(1, (int) ceil($detalle->count() / $porPagina));
        $pagina = min(LengthAwarePaginator::resolveCurrentPage(), $ultimaPagina);

        $paginados = new LengthAwarePaginator(
            $detalle->forPage($pagina, $porPagina)->values(),
            $detalle->count(),
            $porPagina,
            $pagina,
            ['path' => $request->url(), 'query' => $request->query()]
        );


        return Inertia::render('Admin/Reportes/Index', [
            'ventas' => $paginados,
            'totales_vista' => [
                'movimientos' => $detalle->count(),
                'subtotal'    => round($detalle->sum('subtotal'), 2),
                'ganancia'    => round($detalle->sum('ganancia'), 2),
                'capital'     => round($detalle->sum('capital'), 2),
                'descuento'   => round($detalle->sum('descuento'), 2),
                'permuta'     => round($detalle->sum('permuta'), 2),
            ],
            'conteo_tipos' => $items->countBy('tipo'),
            'resumen' => $resumen,
            'serie' => $serie,
            'por_vendedor' => $porVendedor,
            'filtros' => $request->only(['vendedor_id', 'fecha_inicio', 'fecha_fin', 'tipo', 'buscar', 'por_pagina']),
            // Quienes registraron ventas o servicios (el administrador también vende)
            'vendedores' => User::whereIn('id', Venta::query()->select('user_id'))
                ->orWhereIn('id', ServicioTecnico::query()->select('user_id'))
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    /** Encabezado del PDF: período, vendedor y tipo del reporte. */
    private function descripcionFiltros(Request $request): string
    {
        $partes = [
            $request->filled('fecha_inicio') && $request->filled('fecha_fin')
                ? 'Del ' . Carbon::parse($request->fecha_inicio)->format('d/m/Y') . ' al ' . Carbon::parse($request->fecha_fin)->format('d/m/Y')
                : 'Todas las fechas',
        ];

        if ($request->filled('vendedor_id')) {
            $partes[] = 'Vendedor: ' . (User::whereKey($request->vendedor_id)->value('name') ?? '—');
        }

        if ($request->filled('tipo')) {
            $partes[] = 'Tipo: ' . $request->tipo;
        }

        return implode(' · ', $partes);
    }

    public function exportar(Request $request)
    {
        $request->validate([
            'fecha_inicio' => 'nullable|date',
            'fecha_fin'    => 'nullable|date|after_or_equal:fecha_inicio',
            'vendedor_id'  => 'nullable|exists:users,id',
            'tipo'         => ['nullable', Rule::in(self::TIPOS)],
        ]);

        /* =====================================================
     * VENTAS (PRODUCTOS + SERVICIOS HISTÓRICOS)
     * ===================================================== */
        $ventas = Venta::with([
            'vendedor',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'servicioTecnico',
        ])
            ->when(
                $request->filled('vendedor_id'),
                fn($q) =>
                $q->where('user_id', $request->vendedor_id)
            )
            ->when(
                $request->filled('fecha_inicio') && $request->filled('fecha_fin'),
                fn($q) => $q->whereBetween('fecha', [
                    $request->fecha_inicio,
                    $request->fecha_fin
                ])
            )
            ->orderByDesc('fecha')
            ->get();

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES
     * ===================================================== */
        $serviciosTecnicos = ServicioTecnico::with('vendedor')
            ->when(
                $request->filled('vendedor_id'),
                fn($q) =>
                $q->where('user_id', $request->vendedor_id)
            )
            ->when(
                $request->filled('fecha_inicio') && $request->filled('fecha_fin'),
                fn($q) => $q->whereBetween('fecha', [
                    $request->fecha_inicio,
                    $request->fecha_fin
                ])
            )
            ->get();

        $resultados = collect();

        /* =====================================================
     * PROCESAR VENTAS (PRODUCTOS)
     * ===================================================== */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo
                ?? optional($venta->entregadoComputadora)->precio_costo
                ?? optional($venta->entregadoProductoGeneral)->precio_costo
                ?? optional($venta->entregadoProductoApple)->precio_costo
                ?? 0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta ?: $permutaAplicada;

                $tipoProducto = match ($item->tipo) {
                    'celular'          => 'Celular',
                    'computadora'      => 'Computadora',
                    'producto_general' => 'Producto General',
                    'producto_apple'   => 'Producto Apple',
                    default            => '—',
                };

                $nombreProducto = match ($item->tipo) {
                    'celular'          => $item->celular?->modelo ?? '—',
                    'computadora'      => $item->computadora?->nombre ?? '—',
                    'producto_general' => $item->productoGeneral?->nombre ?? '—',
                    'producto_apple'   => $item->productoApple?->modelo ?? '—',
                    default            => '—',
                };

                $ganancia = $item->precio_venta - $item->descuento - $permuta - $item->precio_invertido;

                $resultados->push((object)[
                    'fecha' => $venta->created_at,
                    'cliente'         => $venta->nombre_cliente,
                    'producto'        => $nombreProducto,
                    'tipo'            => $tipoProducto,
                    'cantidad'        => $item->cantidad,
                    'precio_invertido' => $item->precio_invertido,
                    'precio_venta'    => $item->precio_venta,
                    'descuento'       => $item->descuento,
                    'permuta'         => $permuta,
                    'subtotal'        => $item->subtotal,
                    'ganancia'        => $ganancia,
                    'vendedor'        => $venta->vendedor?->name,
                ]);
            }

            /* =====================================================
         * SERVICIOS HISTÓRICOS (VENTAS SIN ITEMS)
         * ===================================================== */
            if ($venta->tipo_venta === 'servicio_tecnico' && $venta->items->isEmpty()) {

                $ganancia = $venta->precio_venta
                    - $venta->descuento
                    - $venta->precio_invertido;

                $resultados->push((object)[
                    'fecha' => $venta->created_at,
                    'cliente'         => $venta->nombre_cliente,
                    'producto'        => 'Servicio Técnico',
                    'tipo'            => 'Servicio Técnico',
                    'cantidad'        => 1,
                    'precio_invertido' => $venta->precio_invertido,
                    'precio_venta'    => $venta->precio_venta,
                    'descuento'       => $venta->descuento,
                    'permuta'         => 0,
                    'subtotal'        => $venta->subtotal,
                    'ganancia'        => $ganancia,
                    'vendedor'        => $venta->vendedor?->name,
                ]);
            }
        }

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES (NUEVOS)
     * ===================================================== */
        foreach ($serviciosTecnicos as $servicio) {

            $ganancia = $servicio->gananciaParaReportes();

            $resultados->push((object)[
                'fecha' => $servicio->created_at,
                'cliente'         => $servicio->nombre_cliente ?? '—',
                'producto'        => 'Servicio Técnico',
                'tipo'            => 'Servicio Técnico',
                'cantidad'        => 1,
                'precio_invertido' => $servicio->costoParaReportes(),
                'precio_venta'    => $servicio->precio_venta,
                'descuento'       => 0,
                'permuta'         => 0,
                'subtotal'        => $servicio->precio_venta,
                'ganancia'        => $ganancia,
                'costo_pendiente'  => (bool) $servicio->costo_pendiente,
                'vendedor'        => $servicio->vendedor?->name,
            ]);
        }

        /* =====================================================
 * ORDEN FINAL POR FECHA Y HORA
 * ===================================================== */

        $resultados = $resultados
            ->sortBy(function ($item) {
                return \Carbon\Carbon::parse($item->fecha)->timestamp;
            })
            ->values();

        // Si en la pantalla se eligió un tipo, el PDF sale solo con ese tipo
        if ($request->filled('tipo')) {
            $resultados = $resultados->where('tipo', $request->tipo)->values();
        }

        $pdf = Pdf::loadView('pdf.reporte_ventas', [
            'ventas'        => $resultados,
            'fecha_inicio'  => $request->fecha_inicio,
            'fecha_fin'     => $request->fecha_fin,
            'filtros_texto' => $this->descripcionFiltros($request),
        ])->setPaper('A4', 'portrait');

        return $pdf->download('reporte_ventas.pdf');
    }

    public function exportDia()
    {
        $hoy = Carbon::now('America/La_Paz')->toDateString();

        /* =====================================================
     * VENTAS DEL DÍA
     * ===================================================== */
        $ventas = Venta::with([
            'vendedor',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'servicioTecnico',
        ])
            ->whereDate('fecha', $hoy)
            ->get();

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES DEL DÍA
     * ===================================================== */
        $serviciosTecnicos = ServicioTecnico::with('vendedor')
            ->whereDate('fecha', $hoy)
            ->get();

        $resultados = collect();

        /* =====================================================
     * PROCESAR VENTAS (PRODUCTOS)
     * ===================================================== */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo
                ?? optional($venta->entregadoComputadora)->precio_costo
                ?? optional($venta->entregadoProductoGeneral)->precio_costo
                ?? optional($venta->entregadoProductoApple)->precio_costo
                ?? 0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta ?: $permutaAplicada;

                $tipoProducto = match ($item->tipo) {
                    'celular'          => 'Celular',
                    'computadora'      => 'Computadora',
                    'producto_general' => 'Producto General',
                    'producto_apple'   => 'Producto Apple',
                    default            => '—',
                };

                $nombreProducto = match ($item->tipo) {
                    'celular'          => $item->celular?->modelo ?? '—',
                    'computadora'      => $item->computadora?->nombre ?? '—',
                    'producto_general' => $item->productoGeneral?->nombre ?? '—',
                    'producto_apple'   => $item->productoApple?->modelo ?? '—',
                    default            => '—',
                };

                $ganancia = $item->precio_venta - $item->descuento - $permuta - $item->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => $nombreProducto,
                    'tipo'             => $tipoProducto,
                    'cantidad'         => $item->cantidad,
                    'precio_invertido' => $item->precio_invertido,
                    'precio_venta'     => $item->precio_venta,
                    'descuento'        => $item->descuento,
                    'permuta'          => $permuta,
                    'subtotal'         => $item->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }

            /* =====================================================
         * SERVICIOS HISTÓRICOS (VENTAS SIN ITEMS)
         * ===================================================== */
            if ($venta->tipo_venta === 'servicio_tecnico' && $venta->items->isEmpty()) {

                $ganancia =
                    $venta->precio_venta
                    - $venta->descuento
                    - $venta->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => 'Servicio Técnico',
                    'tipo'             => 'Servicio Técnico',
                    'cantidad'         => 1,
                    'precio_invertido' => $venta->precio_invertido,
                    'precio_venta'     => $venta->precio_venta,
                    'descuento'        => $venta->descuento,
                    'permuta'          => 0,
                    'subtotal'         => $venta->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }
        }

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES
     * ===================================================== */
        foreach ($serviciosTecnicos as $servicio) {

            $ganancia = $servicio->gananciaParaReportes();

            $resultados->push((object)[
                'fecha'            => $servicio->fecha,
                'cliente'          => $servicio->nombre_cliente ?? '—',
                'producto'         => 'Servicio Técnico',
                'tipo'             => 'Servicio Técnico',
                'cantidad'         => 1,
                'precio_invertido' => $servicio->costoParaReportes(),
                'precio_venta'     => $servicio->precio_venta,
                'descuento'        => 0,
                'permuta'          => 0,
                'subtotal'         => $servicio->precio_venta,
                'ganancia'         => $ganancia,
                'costo_pendiente'   => (bool) $servicio->costo_pendiente,
                'vendedor'         => $servicio->vendedor?->name,
            ]);
        }

        /* =====================================================
     * ORDEN FINAL
     * ===================================================== */
        $resultados = $resultados
            ->sortBy([
                fn($a, $b) =>
                array_search($a->tipo, [
                    'Celular',
                    'Computadora',
                    'Producto General',
                    'Producto Apple',
                    'Servicio Técnico'
                ])
                    <=>
                    array_search($b->tipo, [
                        'Celular',
                        'Computadora',
                        'Producto General',
                        'Producto Apple',
                        'Servicio Técnico'
                    ]),
                fn($a, $b) => strtotime($a->fecha) <=> strtotime($b->fecha),
            ])
            ->values();

        $pdf = Pdf::loadView('pdf.reporte_ventas', [
            'ventas'       => $resultados,
            'fecha_inicio' => $hoy,
            'fecha_fin'    => $hoy,
        ])->setPaper('A4', 'portrait');

        return $pdf->download("reporte_ventas_$hoy.pdf");
    }


    public function exportSemana()
    {
        $inicio = Carbon::now('America/La_Paz')->startOfWeek()->toDateString();
        $fin    = Carbon::now('America/La_Paz')->endOfWeek()->toDateString();

        /* =====================================================
     * VENTAS DE LA SEMANA
     * ===================================================== */
        $ventas = Venta::with([
            'vendedor',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'servicioTecnico',
        ])
            ->whereBetween('fecha', [$inicio, $fin])
            ->get();

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES DE LA SEMANA
     * ===================================================== */
        $serviciosTecnicos = ServicioTecnico::with('vendedor')
            ->whereBetween('fecha', [$inicio, $fin])
            ->get();

        $resultados = collect();

        /* =====================================================
     * PROCESAR VENTAS (PRODUCTOS)
     * ===================================================== */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo
                ?? optional($venta->entregadoComputadora)->precio_costo
                ?? optional($venta->entregadoProductoGeneral)->precio_costo
                ?? optional($venta->entregadoProductoApple)->precio_costo
                ?? 0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta ?: $permutaAplicada;

                $tipoProducto = match ($item->tipo) {
                    'celular'          => 'Celular',
                    'computadora'      => 'Computadora',
                    'producto_general' => 'Producto General',
                    'producto_apple'   => 'Producto Apple',
                    default            => '—',
                };

                $nombreProducto = match ($item->tipo) {
                    'celular'          => $item->celular?->modelo ?? '—',
                    'computadora'      => $item->computadora?->nombre ?? '—',
                    'producto_general' => $item->productoGeneral?->nombre ?? '—',
                    'producto_apple'   => $item->productoApple?->modelo ?? '—',
                    default            => '—',
                };

                $ganancia = $item->precio_venta - $item->descuento - $permuta - $item->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => $nombreProducto,
                    'tipo'             => $tipoProducto,
                    'cantidad'         => $item->cantidad,
                    'precio_invertido' => $item->precio_invertido,
                    'precio_venta'     => $item->precio_venta,
                    'descuento'        => $item->descuento,
                    'permuta'          => $permuta,
                    'subtotal'         => $item->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }

            /* =====================================================
         * SERVICIOS HISTÓRICOS (VENTAS VACÍAS)
         * ===================================================== */
            if ($venta->tipo_venta === 'servicio_tecnico' && $venta->items->isEmpty()) {

                $ganancia =
                    $venta->precio_venta
                    - $venta->descuento
                    - $venta->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => 'Servicio Técnico',
                    'tipo'             => 'Servicio Técnico',
                    'cantidad'         => 1,
                    'precio_invertido' => $venta->precio_invertido,
                    'precio_venta'     => $venta->precio_venta,
                    'descuento'        => $venta->descuento,
                    'permuta'          => 0,
                    'subtotal'         => $venta->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }
        }

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES
     * ===================================================== */
        foreach ($serviciosTecnicos as $servicio) {

            $ganancia = $servicio->gananciaParaReportes();

            $resultados->push((object)[
                'fecha'            => $servicio->fecha,
                'cliente'          => $servicio->nombre_cliente ?? '—',
                'producto'         => 'Servicio Técnico',
                'tipo'             => 'Servicio Técnico',
                'cantidad'         => 1,
                'precio_invertido' => $servicio->costoParaReportes(),
                'precio_venta'     => $servicio->precio_venta,
                'descuento'        => 0,
                'permuta'          => 0,
                'subtotal'         => $servicio->precio_venta,
                'ganancia'         => $ganancia,
                'costo_pendiente'   => (bool) $servicio->costo_pendiente,
                'vendedor'         => $servicio->vendedor?->name,
            ]);
        }

        /* =====================================================
     * ORDEN FINAL
     * ===================================================== */
        $resultados = $resultados
            ->sortBy([
                fn($a, $b) =>
                array_search($a->tipo, [
                    'Celular',
                    'Computadora',
                    'Producto General',
                    'Producto Apple',
                    'Servicio Técnico'
                ])
                    <=>
                    array_search($b->tipo, [
                        'Celular',
                        'Computadora',
                        'Producto General',
                        'Producto Apple',
                        'Servicio Técnico'
                    ]),
                fn($a, $b) => strtotime($a->fecha) <=> strtotime($b->fecha),
            ])
            ->values();

        $pdf = Pdf::loadView('pdf.reporte_ventas', [
            'ventas'       => $resultados,
            'fecha_inicio' => $inicio,
            'fecha_fin'    => $fin,
        ])->setPaper('A4', 'portrait');

        return $pdf->download("reporte_ventas_semana_$inicio-$fin.pdf");
    }

    public function exportMes()
    {
        $inicio = Carbon::now('America/La_Paz')->startOfMonth()->toDateString();
        $fin    = Carbon::now('America/La_Paz')->endOfMonth()->toDateString();

        /* =====================================================
     * VENTAS DEL MES
     * ===================================================== */
        $ventas = Venta::with([
            'vendedor',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'servicioTecnico',
        ])
            ->whereBetween('fecha', [$inicio, $fin])
            ->get();

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES DEL MES
     * ===================================================== */
        $serviciosTecnicos = ServicioTecnico::with('vendedor')
            ->whereBetween('fecha', [$inicio, $fin])
            ->get();

        $resultados = collect();

        /* =====================================================
     * PROCESAR VENTAS (PRODUCTOS)
     * ===================================================== */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo
                ?? optional($venta->entregadoComputadora)->precio_costo
                ?? optional($venta->entregadoProductoGeneral)->precio_costo
                ?? optional($venta->entregadoProductoApple)->precio_costo
                ?? 0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta ?: $permutaAplicada;

                $tipoProducto = match ($item->tipo) {
                    'celular'          => 'Celular',
                    'computadora'      => 'Computadora',
                    'producto_general' => 'Producto General',
                    'producto_apple'   => 'Producto Apple',
                    default            => '—',
                };

                $nombreProducto = match ($item->tipo) {
                    'celular'          => $item->celular?->modelo ?? '—',
                    'computadora'      => $item->computadora?->nombre ?? '—',
                    'producto_general' => $item->productoGeneral?->nombre ?? '—',
                    'producto_apple'   => $item->productoApple?->modelo ?? '—',
                    default            => '—',
                };

                $ganancia = $item->precio_venta - $item->descuento - $permuta - $item->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => $nombreProducto,
                    'tipo'             => $tipoProducto,
                    'cantidad'         => $item->cantidad,
                    'precio_invertido' => $item->precio_invertido,
                    'precio_venta'     => $item->precio_venta,
                    'descuento'        => $item->descuento,
                    'permuta'          => $permuta,
                    'subtotal'         => $item->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }

            /* =====================================================
         * SERVICIOS HISTÓRICOS (VENTAS VACÍAS)
         * ===================================================== */
            if ($venta->tipo_venta === 'servicio_tecnico' && $venta->items->isEmpty()) {

                $ganancia =
                    $venta->precio_venta
                    - $venta->descuento
                    - $venta->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => 'Servicio Técnico',
                    'tipo'             => 'Servicio Técnico',
                    'cantidad'         => 1,
                    'precio_invertido' => $venta->precio_invertido,
                    'precio_venta'     => $venta->precio_venta,
                    'descuento'        => $venta->descuento,
                    'permuta'          => 0,
                    'subtotal'         => $venta->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }
        }

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES
     * ===================================================== */
        foreach ($serviciosTecnicos as $servicio) {

            $ganancia = $servicio->gananciaParaReportes();

            $resultados->push((object)[
                'fecha'            => $servicio->fecha,
                'cliente'          => $servicio->nombre_cliente ?? '—',
                'producto'         => 'Servicio Técnico',
                'tipo'             => 'Servicio Técnico',
                'cantidad'         => 1,
                'precio_invertido' => $servicio->costoParaReportes(),
                'precio_venta'     => $servicio->precio_venta,
                'descuento'        => 0,
                'permuta'          => 0,
                'subtotal'         => $servicio->precio_venta,
                'ganancia'         => $ganancia,
                'costo_pendiente'   => (bool) $servicio->costo_pendiente,
                'vendedor'         => $servicio->vendedor?->name,
            ]);
        }

        /* =====================================================
     * ORDEN FINAL
     * ===================================================== */
        $resultados = $resultados
            ->sortBy([
                fn($a, $b) =>
                array_search($a->tipo, [
                    'Celular',
                    'Computadora',
                    'Producto General',
                    'Producto Apple',
                    'Servicio Técnico'
                ])
                    <=>
                    array_search($b->tipo, [
                        'Celular',
                        'Computadora',
                        'Producto General',
                        'Producto Apple',
                        'Servicio Técnico'
                    ]),
                fn($a, $b) => strtotime($a->fecha) <=> strtotime($b->fecha),
            ])
            ->values();

        $pdf = Pdf::loadView('pdf.reporte_ventas', [
            'ventas'       => $resultados,
            'fecha_inicio' => $inicio,
            'fecha_fin'    => $fin,
        ])->setPaper('A4', 'portrait');

        return $pdf->download("reporte_ventas_mes_$inicio-$fin.pdf");
    }


    public function exportAnio()
    {
        $inicio = Carbon::now('America/La_Paz')->startOfYear()->toDateString();
        $fin    = Carbon::now('America/La_Paz')->endOfYear()->toDateString();

        /* =====================================================
     * VENTAS DEL AÑO
     * ===================================================== */
        $ventas = Venta::with([
            'vendedor',
            'items.celular',
            'items.computadora',
            'items.productoGeneral',
            'items.productoApple',
            'entregadoCelular',
            'entregadoComputadora',
            'entregadoProductoGeneral',
            'entregadoProductoApple',
            'servicioTecnico',
        ])
            ->whereBetween('fecha', [$inicio, $fin])
            ->get();

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES DEL AÑO
     * ===================================================== */
        $serviciosTecnicos = ServicioTecnico::with('vendedor')
            ->whereBetween('fecha', [$inicio, $fin])
            ->get();

        $resultados = collect();

        /* =====================================================
     * PROCESAR VENTAS (PRODUCTOS)
     * ===================================================== */
        foreach ($ventas as $venta) {

            $permutaCosto =
                optional($venta->entregadoCelular)->precio_costo
                ?? optional($venta->entregadoComputadora)->precio_costo
                ?? optional($venta->entregadoProductoGeneral)->precio_costo
                ?? optional($venta->entregadoProductoApple)->precio_costo
                ?? 0;

            $permutaAplicada = false;

            foreach ($venta->items as $item) {

                $aplicaPermuta = in_array($item->tipo, ['celular', 'computadora']) && !$permutaAplicada;
                $permuta = $aplicaPermuta ? $permutaCosto : 0;
                $permutaAplicada = $aplicaPermuta ?: $permutaAplicada;

                $tipoProducto = match ($item->tipo) {
                    'celular'          => 'Celular',
                    'computadora'      => 'Computadora',
                    'producto_general' => 'Producto General',
                    'producto_apple'   => 'Producto Apple',
                    default            => '—',
                };

                $nombreProducto = match ($item->tipo) {
                    'celular'          => $item->celular?->modelo ?? '—',
                    'computadora'      => $item->computadora?->nombre ?? '—',
                    'producto_general' => $item->productoGeneral?->nombre ?? '—',
                    'producto_apple'   => $item->productoApple?->modelo ?? '—',
                    default            => '—',
                };

                $ganancia = $item->precio_venta - $item->descuento - $permuta - $item->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => $nombreProducto,
                    'tipo'             => $tipoProducto,
                    'cantidad'         => $item->cantidad,
                    'precio_invertido' => $item->precio_invertido,
                    'precio_venta'     => $item->precio_venta,
                    'descuento'        => $item->descuento,
                    'permuta'          => $permuta,
                    'subtotal'         => $item->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }

            /* =====================================================
         * SERVICIOS HISTÓRICOS (VENTAS VACÍAS)
         * ===================================================== */
            if ($venta->tipo_venta === 'servicio_tecnico' && $venta->items->isEmpty()) {

                $ganancia =
                    $venta->precio_venta
                    - $venta->descuento
                    - $venta->precio_invertido;

                $resultados->push((object)[
                    'fecha'            => $venta->fecha,
                    'cliente'          => $venta->nombre_cliente,
                    'producto'         => 'Servicio Técnico',
                    'tipo'             => 'Servicio Técnico',
                    'cantidad'         => 1,
                    'precio_invertido' => $venta->precio_invertido,
                    'precio_venta'     => $venta->precio_venta,
                    'descuento'        => $venta->descuento,
                    'permuta'          => 0,
                    'subtotal'         => $venta->subtotal,
                    'ganancia'         => $ganancia,
                    'vendedor'         => $venta->vendedor?->name,
                ]);
            }
        }

        /* =====================================================
     * SERVICIOS TÉCNICOS REALES
     * ===================================================== */
        foreach ($serviciosTecnicos as $servicio) {

            $ganancia = $servicio->gananciaParaReportes();

            $resultados->push((object)[
                'fecha'            => $servicio->fecha,
                'cliente'          => $servicio->nombre_cliente ?? '—',
                'producto'         => 'Servicio Técnico',
                'tipo'             => 'Servicio Técnico',
                'cantidad'         => 1,
                'precio_invertido' => $servicio->costoParaReportes(),
                'precio_venta'     => $servicio->precio_venta,
                'descuento'        => 0,
                'permuta'          => 0,
                'subtotal'         => $servicio->precio_venta,
                'ganancia'         => $ganancia,
                'costo_pendiente'   => (bool) $servicio->costo_pendiente,
                'vendedor'         => $servicio->vendedor?->name,
            ]);
        }

        /* =====================================================
     * ORDEN FINAL
     * ===================================================== */
        $resultados = $resultados
            ->sortBy([
                fn($a, $b) =>
                array_search($a->tipo, [
                    'Celular',
                    'Computadora',
                    'Producto General',
                    'Producto Apple',
                    'Servicio Técnico'
                ])
                    <=>
                    array_search($b->tipo, [
                        'Celular',
                        'Computadora',
                        'Producto General',
                        'Producto Apple',
                        'Servicio Técnico'
                    ]),
                fn($a, $b) => strtotime($a->fecha) <=> strtotime($b->fecha),
            ])
            ->values();

        $pdf = Pdf::loadView('pdf.reporte_ventas', [
            'ventas'       => $resultados,
            'fecha_inicio' => $inicio,
            'fecha_fin'    => $fin,
        ])->setPaper('A4', 'portrait');

        return $pdf->download("reporte_ventas_anio_$inicio-$fin.pdf");
    }
}
