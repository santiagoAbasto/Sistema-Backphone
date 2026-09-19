<?php

namespace App\Http\Controllers;

use App\Models\MovimientoPieza;
use App\Models\Pieza;
use App\Services\StockDePiezas;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Inventario de piezas y repuestos (solo administración).
 *
 * El listado se arma en el servidor: un taller que despieza equipos junta miles de repuestos, y
 * mandar todo al navegador para filtrarlo ahí deja de funcionar bastante antes de eso.
 */
class PiezaController extends Controller
{
    /** Categorías sugeridas al cargar una pieza. El campo es libre: esto es solo para escribir menos. */
    public const CATEGORIAS = [
        'Pantalla', 'Batería', 'Pin de carga', 'Cámara', 'Tapa trasera', 'Altavoz',
        'Flex', 'Placa', 'Botón', 'Bandeja SIM', 'Adhesivo', 'Tornillería', 'Otro',
    ];

    private const MENSAJES = [
        'nombre.required'       => 'Escribe el nombre de la pieza.',
        'nombre.max'            => 'El nombre puede tener hasta 160 caracteres.',
        'cantidad.required'     => 'Escribe cuántas unidades hay.',
        'cantidad.integer'      => 'La cantidad tiene que ser un número entero.',
        'cantidad.min'          => 'La cantidad no puede ser negativa.',
        'cantidad.max'          => 'La cantidad es demasiado grande.',
        'precio_costo.required' => 'Escribe el precio de costo.',
        'precio_venta.required' => 'Escribe el precio de venta.',
        'precio_costo.numeric'  => 'Escribe un monto válido.',
        'precio_venta.numeric'  => 'Escribe un monto válido.',
        'precio_costo.min'      => 'El monto no puede ser negativo.',
        'precio_venta.min'      => 'El monto no puede ser negativo.',
        'codigo.unique'         => 'Ya hay una pieza con este código en esta sucursal.',
    ];

    public function index(Request $request)
    {
        $request->validate([
            'q'         => 'nullable|string|max:120',
            'categoria' => 'nullable|string|max:60',
            'estado'    => ['nullable', Rule::in(['todas', 'disponibles', 'por_agotarse', 'agotadas', 'archivadas'])],
            'orden'     => ['nullable', Rule::in(['nombre', 'recientes', 'stock_asc', 'valor_desc'])],
            'por'       => 'nullable|integer|min:10|max:100',
        ]);

        $q         = trim((string) $request->string('q'));
        $categoria = trim((string) $request->string('categoria'));
        $estado    = (string) ($request->string('estado')->toString() ?: 'todas');
        $orden     = (string) ($request->string('orden')->toString() ?: 'nombre');

        $piezas = $this->consulta($q, $categoria, $estado)
            ->when($orden === 'nombre',     fn ($c) => $c->orderBy('nombre')->orderBy('id'))
            ->when($orden === 'recientes',  fn ($c) => $c->orderByDesc('id'))
            ->when($orden === 'stock_asc',  fn ($c) => $c->orderBy('cantidad')->orderBy('nombre'))
            ->when($orden === 'valor_desc', fn ($c) => $c->orderByRaw('cantidad * precio_venta DESC')->orderBy('nombre'))
            ->paginate((int) $request->integer('por', 25))
            ->withQueryString();

        return Inertia::render('Admin/Piezas/Index', [
            'piezas'      => $piezas,
            'filtros'     => ['q' => $q, 'categoria' => $categoria, 'estado' => $estado, 'orden' => $orden, 'por' => $piezas->perPage()],
            'resumen'     => $this->resumen(),
            'categorias'  => $this->categoriasUsadas(),
            'sugerencias' => self::CATEGORIAS,
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Piezas/Create', [
            'categorias'  => $this->categoriasUsadas(),
            'sugerencias' => self::CATEGORIAS,
        ]);
    }

    public function store(Request $request)
    {
        $datos = $this->validar($request);

        $pieza = DB::transaction(function () use ($datos) {
            $pieza = Pieza::create($datos);
            StockDePiezas::registrarAlta($pieza);

            return $pieza;
        });

        return redirect()->route('admin.piezas.index')
            ->with('success', "«{$pieza->nombre}» quedó en el inventario con {$pieza->cantidad} " . ($pieza->cantidad === 1 ? 'unidad.' : 'unidades.'));
    }

    public function edit(Pieza $pieza)
    {
        return Inertia::render('Admin/Piezas/Edit', [
            'pieza'       => $pieza,
            'movimientos' => $this->historialDe($pieza),
            'bloqueo'     => $this->motivoBloqueo($pieza),
            'categorias'  => $this->categoriasUsadas(),
            'sugerencias' => self::CATEGORIAS,
        ]);
    }

    /**
     * Editar la pieza no mueve el saldo.
     *
     * El nombre, el precio o la compatibilidad se corrigen cuando haga falta; las unidades entran y
     * salen por «Ingresar» o «Ajustar», que dejan su renglón en el historial. Si el formulario
     * pudiera reescribir `cantidad`, el historial mentiría.
     */
    public function update(Request $request, Pieza $pieza)
    {
        $datos = $this->validar($request, $pieza);
        unset($datos['cantidad']);

        $pieza->update($datos);

        return redirect()->route('admin.piezas.index')
            ->with('success', 'Pieza actualizada correctamente.');
    }

    /** Entra mercadería o se corrige el saldo después de un conteo físico. */
    public function stock(Request $request, Pieza $pieza)
    {
        $datos = $request->validate([
            'accion'   => ['required', Rule::in(['ingreso', 'ajuste'])],
            'cantidad' => 'required|integer|min:0|max:1000000',
            'motivo'   => 'nullable|string|max:200',
        ], [
            'cantidad.required' => 'Escribe la cantidad.',
            'cantidad.min'      => 'La cantidad no puede ser negativa.',
        ]);

        $motivo = trim((string) ($datos['motivo'] ?? '')) ?: null;

        $movimiento = DB::transaction(function () use ($pieza, $datos, $motivo) {
            $bloqueada = StockDePiezas::bloquear($pieza->id);

            if (! $bloqueada) {
                return null;
            }

            return $datos['accion'] === 'ingreso'
                ? StockDePiezas::ingresar($bloqueada, (int) $datos['cantidad'], $motivo)
                : StockDePiezas::ajustar($bloqueada, (int) $datos['cantidad'], $motivo);
        });

        if (! $movimiento) {
            return back()->with('success', 'El saldo ya era ese: no se anotó ningún movimiento.');
        }

        $verbo = $movimiento->cantidad > 0 ? 'Entraron' : 'Salieron';

        return back()->with('success', "{$verbo} " . abs($movimiento->cantidad) . " de «{$pieza->nombre}». Quedan {$movimiento->saldo}.");
    }

    /** Sacarla de las listas sin borrar su historial. */
    public function archivar(Request $request, Pieza $pieza)
    {
        $activa = $request->boolean('activa');
        $pieza->update(['activa' => $activa]);

        return back()->with('success', $activa
            ? "«{$pieza->nombre}» vuelve a estar disponible."
            : "«{$pieza->nombre}» quedó archivada: ya no aparece al vender ni al reparar.");
    }

    public function destroy(Pieza $pieza)
    {
        if ($motivo = $this->motivoBloqueo($pieza)) {
            return back()->with('error', "No se puede eliminar. {$motivo}");
        }

        $pieza->delete();

        return redirect()->route('admin.piezas.index')
            ->with('success', 'Pieza eliminada correctamente.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function consulta(string $q, string $categoria, string $estado)
    {
        $consulta = Pieza::query();

        $consulta = match ($estado) {
            'disponibles'  => $consulta->where('activa', true)->where('cantidad', '>', 0),
            'agotadas'     => $consulta->where('activa', true)->where('cantidad', '<=', 0),
            'por_agotarse' => $consulta->where('activa', true)->where('minimo', '>', 0)
                ->where('cantidad', '>', 0)->whereColumn('cantidad', '<=', 'minimo'),
            'archivadas'   => $consulta->where('activa', false),
            default        => $consulta,
        };

        if ($categoria !== '') {
            $consulta->where('categoria', $categoria);
        }

        if ($q !== '') {
            // LOWER + LIKE se comporta igual en PostgreSQL y en SQLite (los tests corren en SQLite)
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], mb_strtolower($q)) . '%';
            $consulta->where(function ($w) use ($like) {
                foreach (['nombre', 'codigo', 'categoria', 'compatibilidad', 'origen'] as $columna) {
                    $w->orWhereRaw("LOWER(COALESCE({$columna}, '')) LIKE ?", [$like]);
                }
            });
        }

        return $consulta;
    }

    /** Los números de arriba del listado, sobre el inventario entero y no sobre la página que se mira. */
    private function resumen(): array
    {
        $activas = Pieza::where('activa', true);

        return [
            'referencias'  => (clone $activas)->count(),
            'unidades'     => (int) (clone $activas)->sum('cantidad'),
            'costo'        => round((float) (clone $activas)->selectRaw('COALESCE(SUM(cantidad * precio_costo), 0) AS t')->value('t'), 2),
            'venta'        => round((float) (clone $activas)->selectRaw('COALESCE(SUM(cantidad * precio_venta), 0) AS t')->value('t'), 2),
            'agotadas'     => (clone $activas)->where('cantidad', '<=', 0)->count(),
            'por_agotarse' => (clone $activas)->where('minimo', '>', 0)->where('cantidad', '>', 0)
                ->whereColumn('cantidad', '<=', 'minimo')->count(),
            'archivadas'   => Pieza::where('activa', false)->count(),
        ];
    }

    private function categoriasUsadas(): array
    {
        return Pieza::query()
            ->whereNotNull('categoria')
            ->where('categoria', '<>', '')
            ->groupBy('categoria')
            ->orderByRaw('COUNT(*) DESC')
            ->limit(60)
            ->pluck('categoria')
            ->values()
            ->all();
    }

    /** Los últimos movimientos, ya listos para la pantalla. */
    private function historialDe(Pieza $pieza): array
    {
        return $pieza->movimientos()->with('usuario:id,name')->limit(40)->get()
            ->map(fn (MovimientoPieza $m) => [
                'id'       => $m->id,
                'tipo'     => $m->tipo,
                'etiqueta' => $m->etiqueta,
                'cantidad' => $m->cantidad,
                'saldo'    => $m->saldo,
                'motivo'   => $m->motivo,
                'quien'    => $m->usuario?->name,
                'fecha'    => $m->created_at?->toIso8601String(),
            ])->all();
    }

    /** Por qué no se puede eliminar (null si se puede). */
    private function motivoBloqueo(Pieza $pieza): ?string
    {
        $usada = MovimientoPieza::where('pieza_id', $pieza->id)
            ->whereIn('tipo', [MovimientoPieza::VENTA, MovimientoPieza::SERVICIO])
            ->exists();

        return $usada
            ? 'Ya salió en ventas o reparaciones y se conserva para no perder el historial. Archívala para que deje de aparecer.'
            : null;
    }

    private function validar(Request $request, ?Pieza $pieza = null): array
    {
        if ($request->has('codigo')) {
            $codigo = mb_strtoupper(trim((string) $request->input('codigo')));
            $request->merge(['codigo' => $codigo === '' ? null : $codigo]);
        }

        $datos = $request->validate([
            'nombre'         => 'required|string|max:160',
            'cantidad'       => 'required|integer|min:0|max:1000000',
            'precio_costo'   => 'required|numeric|min:0|max:99999999.99',
            'precio_venta'   => 'required|numeric|min:0|max:99999999.99',
            'codigo'         => [
                'nullable', 'string', 'max:60',
                Rule::unique('piezas', 'codigo')
                    ->where('sucursal_id', $pieza?->sucursal_id ?? \App\Support\SucursalActiva::paraGuardar())
                    ->ignore($pieza?->id),
            ],
            'categoria'      => 'nullable|string|max:60',
            'compatibilidad' => 'nullable|string|max:160',
            'origen'         => 'nullable|string|max:160',
            'minimo'         => 'nullable|integer|min:0|max:10000',
            'notas'          => 'nullable|string|max:2000',
            'activa'         => 'nullable|boolean',
        ], self::MENSAJES);

        $datos['minimo'] = (int) ($datos['minimo'] ?? 0);
        $datos['activa'] = $request->boolean('activa', true);

        foreach (['categoria', 'compatibilidad', 'origen', 'notas'] as $campo) {
            $datos[$campo] = trim((string) ($datos[$campo] ?? '')) ?: null;
        }

        return $datos;
    }
}
