<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sucursal;
use App\Models\Traspaso;
use App\Services\TraspasoDeInventario;
use App\Support\SucursalActiva;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Traspasos de inventario entre sucursales.
 *
 * Enviar es del super administrador: es el único que ve las dos sucursales a la vez y puede
 * decidir qué se reparte. Confirmar que llegó es de quien recibe, que es el que abre el paquete.
 */
class TraspasoController extends Controller
{
    /** Por dónde se busca dentro de cada inventario. */
    private const BUSCAR = [
        'celular'          => ['modelo', 'capacidad', 'color', 'imei_1', 'imei_2', 'numero_serie'],
        'computadora'      => ['nombre', 'procesador', 'ram', 'almacenamiento', 'numero_serie'],
        'producto_apple'   => ['modelo', 'capacidad', 'color', 'imei_1', 'imei_2', 'numero_serie'],
        'producto_general' => ['codigo', 'tipo', 'nombre'],
        'pieza'            => ['codigo', 'nombre', 'categoria', 'compatibilidad'],
    ];

    public function index(Request $request)
    {
        $request->validate([
            'origen'  => 'nullable|integer|exists:sucursales,id',
            'tipo'    => ['nullable', Rule::in(array_keys(Traspaso::TIPOS))],
            'q'       => 'nullable|string|max:120',
        ]);

        $puedeEnviar = SucursalActiva::puedeElegir();
        // `activas()` ya devuelve la colección, no el query
        $sucursales  = Sucursal::activas()->map(fn (Sucursal $s) => [
            'id'     => $s->id,
            'nombre' => $s->nombre,
            'ciudad' => $s->ciudad,
        ])->values();

        // El origen por defecto es la sucursal en la que se está parado; el super administrador
        // que mira «Todas» arranca en la primera.
        $origen = (int) ($request->integer('origen') ?: SucursalActiva::id() ?: ($sucursales->first()['id'] ?? null));
        $tipo   = (string) ($request->string('tipo')->toString() ?: 'celular');
        $q      = trim((string) $request->string('q'));

        return Inertia::render('Admin/Traspasos/Index', [
            'sucursales'  => $sucursales,
            'puedeEnviar' => $puedeEnviar,
            'miSucursal'  => SucursalActiva::id(),
            'filtros'     => ['origen' => $origen, 'tipo' => $tipo, 'q' => $q],
            'tipos'       => collect(Traspaso::TIPOS)
                ->map(fn ($config, $clave) => [
                    'value' => $clave,
                    'label' => $config['label'],
                    'total' => $this->disponibles($clave, $origen, '')->count(),
                ])->values(),
            'productos'   => $puedeEnviar ? $this->disponibles($tipo, $origen, $q)
                ->limit(60)
                ->get()
                ->map(fn ($p) => $this->paraElegir($tipo, $p))
                ->all() : [],
            'traspasos'   => $this->historial(),
        ]);
    }

    public function store(Request $request)
    {
        abort_unless(SucursalActiva::puedeElegir(), 403, 'Solo el super administrador reparte inventario entre sucursales.');

        $datos = $request->validate([
            'origen_sucursal_id'  => 'required|integer|exists:sucursales,id',
            'destino_sucursal_id' => 'required|integer|exists:sucursales,id|different:origen_sucursal_id',
            'nota'                => 'nullable|string|max:500',
            'items'               => 'required|array|min:1',
            'items.*.tipo'        => ['required', Rule::in(array_keys(Traspaso::TIPOS))],
            'items.*.producto_id' => 'required|integer',
            'items.*.cantidad'    => 'nullable|integer|min:1',
        ], [
            'items.required'                  => 'Elige al menos un producto para enviar.',
            'destino_sucursal_id.different'   => 'El origen y el destino tienen que ser sucursales distintas.',
        ]);

        $traspaso = TraspasoDeInventario::enviar(
            (int) $datos['origen_sucursal_id'],
            (int) $datos['destino_sucursal_id'],
            $datos['items'],
            trim((string) ($datos['nota'] ?? '')) ?: null,
        );

        $cuantos = $traspaso->items->count();

        return back()->with('success', "{$traspaso->codigo}: salieron {$cuantos} "
            . ($cuantos === 1 ? 'producto' : 'productos')
            . " hacia {$traspaso->destino->nombre}. Quedan en tránsito hasta que allá confirmen que llegaron.");
    }

    public function recibir(Traspaso $traspaso)
    {
        $this->autorizar($traspaso->destino_sucursal_id, 'Este traspaso lo confirma la sucursal que lo recibe.');

        TraspasoDeInventario::recibir($traspaso->load('items'));

        return back()->with('success', "{$traspaso->codigo} recibido: el inventario ya se puede vender en {$traspaso->destino->nombre}.");
    }

    public function cancelar(Traspaso $traspaso)
    {
        $this->autorizar($traspaso->origen_sucursal_id, 'Un traspaso lo cancela la sucursal que lo envió.');

        TraspasoDeInventario::cancelar($traspaso->load('items'));

        return back()->with('success', "{$traspaso->codigo} cancelado: todo volvió a estar disponible en {$traspaso->origen->nombre}.");
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    /** El super administrador puede con los dos lados; el resto, solo con el suyo. */
    private function autorizar(int $sucursalId, string $motivo): void
    {
        if (SucursalActiva::puedeElegir()) {
            return;
        }

        abort_unless((int) auth()->user()->sucursal_id === $sucursalId, 403, $motivo);
    }

    /** Lo que se puede enviar hoy desde esa sucursal: sin vender, sin reservar y sin viajar ya. */
    private function disponibles(string $tipo, int $origenId, string $q)
    {
        $modelo = Traspaso::TIPOS[$tipo]['modelo'];

        $consulta = $modelo::withoutGlobalScope('sucursal')->where('sucursal_id', $origenId);

        $consulta = $tipo === 'pieza'
            ? $consulta->where('activa', true)->where('cantidad', '>', 0)
            : $consulta->where('estado', 'disponible');

        if ($q !== '') {
            // LOWER + LIKE se comporta igual en PostgreSQL y en SQLite (los tests corren en SQLite)
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], mb_strtolower($q)) . '%';
            $consulta->where(function ($w) use ($tipo, $like) {
                foreach (self::BUSCAR[$tipo] as $columna) {
                    $w->orWhereRaw("LOWER(COALESCE({$columna}, '')) LIKE ?", [$like]);
                }
            });
        }

        return $consulta->orderBy($tipo === 'celular' || $tipo === 'producto_apple' ? 'modelo' : 'nombre');
    }

    /** Lo que necesita la lista para elegir: nombre, cómo distinguirlo y cuánto hay. */
    private function paraElegir(string $tipo, $p): array
    {
        return [
            'id'       => $p->id,
            'tipo'     => $tipo,
            'nombre'   => $tipo === 'celular' || $tipo === 'producto_apple' ? $p->modelo : $p->nombre,
            'detalle'  => match ($tipo) {
                'celular', 'producto_apple' => implode(' · ', array_filter([$p->capacidad, $p->color, $p->imei_1])),
                'computadora'               => implode(' · ', array_filter([$p->procesador, $p->ram, $p->numero_serie])),
                'producto_general'          => implode(' · ', array_filter([$p->tipo, $p->codigo])),
                'pieza'                     => implode(' · ', array_filter([$p->categoria, $p->compatibilidad])),
                default                     => null,
            } ?: null,
            'precio'   => (float) $p->precio_venta,
            'cantidad' => $tipo === 'pieza' ? (int) $p->cantidad : 1,
        ];
    }

    /** Los traspasos que le tocan a quien mira: los que manda su sucursal y los que espera. */
    private function historial(): array
    {
        return Traspaso::with(['items', 'origen:id,nombre', 'destino:id,nombre', 'quienEnvio:id,name', 'quienRecibio:id,name'])
            ->deSucursal(SucursalActiva::id())
            ->orderByRaw("CASE estado WHEN 'en_transito' THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->limit(40)
            ->get()
            ->map(fn (Traspaso $t) => [
                'id'        => $t->id,
                'codigo'    => $t->codigo,
                'estado'    => $t->estado,
                'origen'    => $t->origen->nombre,
                'destino'   => $t->destino->nombre,
                'destinoId' => $t->destino_sucursal_id,
                'origenId'  => $t->origen_sucursal_id,
                'nota'      => $t->nota,
                'enviadoPor' => $t->quienEnvio?->name,
                'enviadoEn'  => $t->enviado_en?->toIso8601String(),
                'recibidoPor' => $t->quienRecibio?->name,
                'recibidoEn'  => $t->recibido_en?->toIso8601String(),
                'items'     => $t->items->map(fn ($i) => [
                    'tipo'     => $i->tipo,
                    'nombre'   => $i->nombre,
                    'detalle'  => $i->detalle,
                    'cantidad' => $i->cantidad,
                ])->all(),
                'unidades'  => (int) $t->items->sum('cantidad'),
            ])->all();
    }
}
