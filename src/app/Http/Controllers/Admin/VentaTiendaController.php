<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\VentaController;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\Pieza;
use App\Models\ProductoApple;
use App\Models\ProductoGeneral;
use App\Models\ReservaItem;
use App\Models\Tienda;
use App\Models\Venta;
use App\Support\Busqueda;
use App\Support\SucursalActiva;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Ventas a otras tiendas, a precio mayorista.
 *
 * Una venta a tienda es una venta normal con `tienda_id`: por eso no hay lógica de stock, de notas
 * ni de caja acá. Esta pantalla solo junta los datos de la tienda y el precio de cada producto, y
 * se los pasa a `VentaController::store`, que descuenta el inventario, numera la nota y suma a la caja.
 *
 * Ningún producto sin precio para tiendas se ofrece ni se vende: nunca se usa por error el precio
 * de cliente final.
 */
class VentaTiendaController extends Controller
{
    /** Por cada tipo: modelo y columnas donde se busca. Las piezas van aparte (saldo, sin estado). */
    private const BUSCABLES = [
        'celular'          => [Celular::class, ['modelo', 'imei_1', 'imei_2', 'color', 'capacidad']],
        'computadora'      => [Computadora::class, ['nombre', 'numero_serie', 'procesador', 'color']],
        'producto_apple'   => [ProductoApple::class, ['modelo', 'imei_1', 'numero_serie', 'color']],
        'producto_general' => [ProductoGeneral::class, ['nombre', 'codigo', 'tipo']],
    ];

    private const POR_TIPO = 8;

    private const MENSAJES = [
        'tienda.nombre.required'  => 'Escribe el nombre de la tienda.',
        'tienda.nombre.max'       => 'El nombre puede tener hasta 120 caracteres.',
        'tienda.responsable.max'  => 'El responsable puede tener hasta 120 caracteres.',
        'tienda.telefono.max'     => 'El teléfono puede tener hasta 40 caracteres.',
        'metodo_pago.required'    => 'Elige cómo pagó la tienda.',
        'metodo_pago.in'          => 'Elige cómo pagó la tienda.',
        'inicio_tarjeta.required_if' => 'Escribe los 4 primeros números de la tarjeta.',
        'fin_tarjeta.required_if'    => 'Escribe los 4 últimos números de la tarjeta.',
        'inicio_tarjeta.digits'   => 'Son 4 números.',
        'fin_tarjeta.digits'      => 'Son 4 números.',
        'items.required'          => 'Agrega al menos un producto.',
        'items.min'               => 'Agrega al menos un producto.',
        'items.*.precio.required' => 'Escribe el precio al que se vende.',
        'items.*.precio.numeric'  => 'El precio tiene que ser un número.',
        'items.*.precio.gt'       => 'El precio tiene que ser mayor a cero.',
        'items.*.cantidad.min'    => 'La cantidad mínima es 1.',
    ];

    public function index(Request $request)
    {
        $request->validate(['tienda' => 'nullable|integer']);

        $ventas = Venta::query()
            ->whereNotNull('tienda_id')
            ->when($request->filled('tienda'), fn ($q) => $q->where('tienda_id', $request->integer('tienda')))
            ->with('tienda:id,nombre,responsable,telefono')
            ->withCount('items')
            ->latest('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Venta $v) => [
                'id'          => $v->id,
                'codigo_nota' => $v->codigo_nota,
                'tienda'      => $v->tienda?->nombre ?? $v->nombre_cliente,
                'responsable' => $v->tienda?->responsable,
                'telefono'    => $v->tienda?->telefono,
                'total'       => (float) $v->subtotal,
                'metodo_pago' => $v->metodo_pago,
                'items'       => $v->items_count,
                'fecha'       => $v->created_at,
            ]);

        return Inertia::render('Admin/VentasTiendas/Index', [
            'ventas'  => $ventas,
            'tiendas' => $this->tiendas(),
            'filtros' => ['tienda' => $request->filled('tienda') ? $request->integer('tienda') : null],
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/VentasTiendas/Create', [
            'tiendas' => $this->tiendas(),
        ]);
    }

    /** Productos disponibles que tienen precio para tiendas, de los cinco tipos del inventario. */
    public function productos(Request $request)
    {
        $request->validate(['q' => 'nullable|string|max:80']);

        $q = trim((string) $request->input('q'));

        if ($q === '') {
            return response()->json([]);
        }

        $patron = Busqueda::contiene($q);
        $lista  = collect();

        foreach (self::BUSCABLES as $tipo => [$modelo, $columnas]) {
            $modelo::query()
                ->where('estado', 'disponible')
                ->whereNotNull('precio_tienda')
                ->whereNotIn('id', $this->reservados($tipo))
                ->where(function ($c) use ($columnas, $patron) {
                    foreach ($columnas as $columna) {
                        $c->orWhereRaw("LOWER($columna) LIKE ?", [$patron]);
                    }
                })
                ->orderBy($columnas[0])
                ->limit(self::POR_TIPO)
                ->get()
                ->each(fn ($p) => $lista->push($this->ficha($tipo, $p)));
        }

        // Una pieza no se reserva ni tiene estado: se ofrece si está activa y le queda saldo.
        Pieza::disponibles()
            ->whereNotNull('precio_tienda')
            ->where(function ($c) use ($patron) {
                foreach (['nombre', 'codigo', 'categoria', 'compatibilidad'] as $columna) {
                    $c->orWhereRaw("LOWER($columna) LIKE ?", [$patron]);
                }
            })
            ->orderBy('nombre')
            ->limit(self::POR_TIPO)
            ->get()
            ->each(fn ($p) => $lista->push($this->ficha('pieza', $p)));

        return response()->json($lista->values());
    }

    public function store(Request $request, VentaController $ventas)
    {
        $datos = $request->validate([
            'tienda.nombre'      => 'required|string|max:120',
            'tienda.responsable' => 'nullable|string|max:120',
            'tienda.telefono'    => 'nullable|string|max:40',
            // Sin valor por defecto: quien cobra elige cómo le pagaron
            'metodo_pago'        => 'required|in:efectivo,qr,transferencia,tarjeta',
            'inicio_tarjeta'     => 'required_if:metodo_pago,tarjeta|nullable|digits:4',
            'fin_tarjeta'        => 'required_if:metodo_pago,tarjeta|nullable|digits:4',
            'items'              => 'required|array|min:1',
            'items.*.tipo'       => 'required|in:celular,computadora,producto_general,producto_apple,pieza',
            'items.*.producto_id' => 'required|integer',
            'items.*.cantidad'   => 'required|integer|min:1',
            'items.*.precio'     => 'required|numeric|gt:0',
        ], self::MENSAJES);

        // Todo o nada: si la venta falla (se agotó una pieza, un equipo ya se vendió), la tienda
        // tampoco queda creada ni con datos cambiados.
        return DB::transaction(function () use ($request, $ventas, $datos) {
            $tienda = $this->tiendaDe($datos['tienda']);

            // Se arma una request nueva con lo justo: lo que sobre del navegador (descuento, reserva,
            // permuta, otro tipo de venta) no llega a la venta. La marca de tienda va como atributo,
            // que el navegador no puede mandar.
            $request->replace([
                'nombre_cliente'   => $tienda->nombre,
                'telefono_cliente' => $tienda->telefono,
                'tipo_venta'       => 'producto',
                'es_permuta'       => false,
                'metodo_pago'      => $datos['metodo_pago'],
                'inicio_tarjeta'   => $datos['inicio_tarjeta'] ?? null,
                'fin_tarjeta'      => $datos['fin_tarjeta'] ?? null,
                'items'            => $datos['items'],
            ]);
            // También se vacía la URL: VentaController lee el descuento y las notas con $request->campo
            $request->query->replace([]);
            $request->attributes->set('venta_a_tienda', $tienda);

            return $ventas->store($request);
        });
    }

    /** La nota de una venta a tienda. Pasa por acá para que el permiso sea el de este módulo. */
    public function boleta(Venta $venta, VentaController $ventas)
    {
        abort_unless($venta->tienda_id, 404);

        return $ventas->boleta($venta);
    }

    public function boleta80(Venta $venta, VentaController $ventas)
    {
        abort_unless($venta->tienda_id, 404);

        return $ventas->boleta80($venta);
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function tiendas()
    {
        return Tienda::orderBy('nombre')->get(['id', 'nombre', 'responsable', 'telefono']);
    }

    /**
     * La tienda de esta sucursal con ese nombre, o una nueva. Mayúsculas y espacios no cuentan:
     * «Tienda  Pérez» y «tienda pérez» son la misma. Responsable y teléfono se actualizan si vinieron.
     */
    private function tiendaDe(array $datos): Tienda
    {
        $nombre = trim(preg_replace('/\s+/', ' ', $datos['nombre']));

        $tienda = Tienda::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->first()
            ?? Tienda::create(['sucursal_id' => SucursalActiva::paraGuardar(), 'nombre' => $nombre]);

        $tienda->fill(array_filter([
            'responsable' => trim((string) ($datos['responsable'] ?? '')),
            'telefono'    => trim((string) ($datos['telefono'] ?? '')),
        ], fn ($valor) => $valor !== ''))->save();

        return $tienda;
    }

    /** Lo que ya está apartado en una reserva activa no se ofrece, igual que en el resto de las ventas. */
    private function reservados(string $tipo)
    {
        return ReservaItem::where('tipo', $tipo)
            ->whereHas('reserva', fn ($q) => $q->where('estado', 'activa'))
            ->pluck('producto_id');
    }

    /** Lo necesario para mostrar el producto. Nunca viaja el costo. */
    private function ficha(string $tipo, $p): array
    {
        [$nombre, $detalle, $codigo] = match ($tipo) {
            'celular'          => [$p->modelo, [$p->capacidad, $p->color], $p->imei_1],
            'computadora'      => [$p->nombre, [$p->procesador, $p->ram, $p->almacenamiento], $p->numero_serie],
            'producto_apple'   => [$p->modelo, [$p->capacidad, $p->color], $p->imei_1 ?: $p->numero_serie],
            'producto_general' => [$p->nombre, [$p->tipo], $p->codigo],
            'pieza'            => [$p->nombre, [$p->compatibilidad ?: $p->categoria], $p->codigo],
        };

        return [
            'tipo'          => $tipo,
            'id'            => $p->id,
            'nombre'        => $nombre,
            'detalle'       => implode(' · ', array_filter($detalle)),
            'codigo'        => $codigo,
            'precio_tienda' => (float) $p->precio_tienda,
            'precio_venta'  => (float) $p->precio_venta,
            // Solo las piezas se llevan por cantidad; lo demás es un equipo concreto
            'cantidad'      => $tipo === 'pieza' ? (int) $p->cantidad : null,
        ];
    }
}
