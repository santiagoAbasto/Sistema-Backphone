<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EquipoDeInventario;
use App\Models\MovimientoPieza;
use App\Models\MovimientoProductoGeneral;
use App\Models\ProductoGeneral;
use App\Services\StockPorCantidad;
use App\Support\CondicionInventario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Fundas, vidrios, cargadores y accesorios (solo administración).
 *
 * Van por cantidad: se cargan una vez con cuántos llegaron («Vidrio templado 9D · iPhone 13 ·
 * Premium, 500») y el sistema les pone el código. Cada venta, reparación o traspaso descuenta del
 * saldo, y todo movimiento queda en el historial del producto. El conteo físico compara lo que se
 * contó con lo que dice el sistema y anota la diferencia.
 */
class ProductoGeneralController extends Controller
{
    use EquipoDeInventario;

    public const TIPOS = ['funda', 'vidrio_templado', 'vidrio_camara', 'cargador_20w', 'cargador_5w', 'accesorio', 'otro'];

    private const MENSAJES = [
        'codigo.required'       => 'Escribe el código.',
        'codigo.max'            => 'El código puede tener hasta 255 caracteres.',
        'codigo.unique'         => 'Ya hay un producto con este código.',
        'tipo.required'         => 'Elige el tipo de producto.',
        'tipo.in'               => 'Elige el tipo de producto.',
        'nombre.required'       => 'Escribe el nombre.',
        'nombre.max'            => 'El nombre puede tener hasta 255 caracteres.',
        'modelo.max'            => 'El modelo puede tener hasta 120 caracteres.',
        'calidad.max'           => 'La calidad puede tener hasta 60 caracteres.',
        'cantidad.required'     => 'Escribe cuántas unidades llegaron.',
        'cantidad.integer'      => 'La cantidad tiene que ser un número entero.',
        'cantidad.min'          => 'Tiene que entrar al menos una unidad.',
        'cantidad.max'          => 'La cantidad es demasiado grande.',
        'procedencia.required'  => 'Escribe de dónde llegó el producto.',
        'procedencia.max'       => 'La procedencia puede tener hasta 100 caracteres.',
        'precio_costo.required' => 'Escribe el precio de costo.',
        'precio_venta.required' => 'Escribe el precio de venta.',
        'precio_costo.numeric'  => 'Escribe un monto válido.',
        'precio_venta.numeric'  => 'Escribe un monto válido.',
        'precio_costo.min'      => 'El monto no puede ser negativo.',
        'precio_venta.min'      => 'El monto no puede ser negativo.',
        'precio_costo.max'      => 'El monto es demasiado grande.',
        'precio_venta.max'      => 'El monto es demasiado grande.',
        'precio_tienda.numeric' => 'Escribe un monto válido.',
        'precio_tienda.gt'      => 'El precio para tiendas tiene que ser mayor a cero. Si no le vendes a tiendas, déjalo vacío.',
        'precio_tienda.max'     => 'El monto es demasiado grande.',
    ];

    private const COLUMNAS_LISTADO = [
        'id', 'codigo', 'tipo', 'nombre', 'modelo', 'calidad', 'cantidad', 'procedencia',
        'precio_costo', 'precio_venta', 'precio_tienda', 'estado', 'condicion', 'created_at',
    ];

    protected function inventario(): array
    {
        return ['tipo' => 'producto_general', 'venta' => 'producto_general_id', 'permuta' => 'entregado_producto_general_id'];
    }

    public function index(Request $request)
    {
        // El vendedor tiene su propia pantalla de productos
        if ($request->user()?->rol !== 'admin') {
            return redirect()->route('vendedor.productos.index');
        }

        return Inertia::render('Admin/ProductosGenerales/Index', [
            'productos'    => ProductoGeneral::query()
                ->orderByRaw("CASE estado WHEN 'disponible' THEN 0 WHEN 'permuta' THEN 1 ELSE 2 END")
                ->orderBy('nombre')
                ->orderBy('modelo')
                ->orderByDesc('id')
                ->get(self::COLUMNAS_LISTADO),
            'conHistorial' => $this->idsConHistorial(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/ProductosGenerales/Create', [
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    /** Entra el producto con todas sus unidades; si no trae código, se lo pone el sistema. */
    public function store(Request $request)
    {
        $datos = $this->validar($request);

        $producto = DB::transaction(function () use ($datos) {
            $sinCodigo = blank($datos['codigo'] ?? null);

            $producto = ProductoGeneral::create([
                ...$datos,
                // Provisorio y único: el definitivo lleva el número del registro, que recién ahora existe
                'codigo' => $sinCodigo ? 'TMP-' . Str::uuid() : $datos['codigo'],
                'estado' => ProductoGeneral::ESTADO_DISPONIBLE,
            ]);

            if ($sinCodigo) {
                $producto->asignarCodigoAutomatico();
            }

            StockPorCantidad::registrarAlta($producto);

            return $producto;
        });

        $unidades = $producto->cantidad === 1 ? '1 unidad' : number_format($producto->cantidad, 0, ',', '.') . ' unidades';

        return redirect($this->destinoSeguro($request->input('return_to'), route('admin.productos-generales.index')))
            ->with('success', "«{$producto->etiqueta()}» entró con {$unidades}. Código {$producto->codigo}.");
    }

    public function verificarCodigo(Request $request)
    {
        $codigo = mb_strtoupper(trim((string) $request->query('codigo')));

        return response()->json([
            'existe' => $codigo !== '' && ProductoGeneral::withoutGlobalScopes()->whereRaw('UPPER(codigo) = ?', [$codigo])->exists(),
        ]);
    }

    public function show(ProductoGeneral $producto)
    {
        return redirect()->route('admin.productos-generales.edit', $producto);
    }

    public function edit(ProductoGeneral $producto)
    {
        return Inertia::render('Admin/ProductosGenerales/Edit', [
            'producto'    => $producto,
            'movimientos' => $this->movimientosDe($producto),
            'bloqueo'     => $this->bloqueo($producto),
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    /**
     * Editar la ficha no mueve el saldo ni el estado.
     *
     * Las unidades entran por «Ingresar» y se corrigen por «Ajustar» o por el conteo, que dejan su
     * renglón en el historial. Si el formulario pudiera reescribir la cantidad, el historial mentiría.
     */
    public function update(Request $request, ProductoGeneral $producto)
    {
        if ($frenado = $this->frenarSiViaja($producto)) {
            return $frenado;
        }

        $producto->update($this->validar($request, $producto));

        return redirect()->route('admin.productos-generales.index')
            ->with('success', 'Producto actualizado correctamente.');
    }

    /** Entra mercadería o se corrige el saldo de un producto después de contarlo. */
    public function stock(Request $request, ProductoGeneral $producto)
    {
        $datos = $request->validate([
            'accion'   => ['required', Rule::in(['ingreso', 'ajuste'])],
            'cantidad' => 'required|integer|min:0|max:1000000',
            'motivo'   => 'nullable|string|max:200',
        ], [
            'cantidad.required' => 'Escribe la cantidad.',
            'cantidad.min'      => 'La cantidad no puede ser negativa.',
        ]);

        if ($producto->estado === ProductoGeneral::ESTADO_PERMUTA) {
            return back()->with('error', 'Llegó en una permuta: habilítalo para la venta antes de moverle el saldo.');
        }

        $motivo = trim((string) ($datos['motivo'] ?? '')) ?: null;

        $movimiento = DB::transaction(function () use ($producto, $datos, $motivo) {
            $bloqueado = StockPorCantidad::bloquear($producto->id, ProductoGeneral::class);

            if (! $bloqueado) {
                return null;
            }

            return $datos['accion'] === 'ingreso'
                ? StockPorCantidad::ingresar($bloqueado, (int) $datos['cantidad'], $motivo)
                : StockPorCantidad::ajustar($bloqueado, (int) $datos['cantidad'], $motivo ?? 'Conteo físico');
        });

        if (! $movimiento) {
            return back()->with('success', 'El saldo ya era ese: no se anotó ningún movimiento.');
        }

        $verbo = $movimiento->cantidad > 0 ? 'Entraron' : 'Salieron';

        return back()->with('success', "{$verbo} " . abs($movimiento->cantidad) . " de «{$producto->etiqueta()}». Quedan {$movimiento->saldo}.");
    }

    /** La planilla para contar todo el inventario de una vez. */
    public function conteo()
    {
        return Inertia::render('Admin/ProductosGenerales/Conteo', [
            // Lo que está en permuta no se cuenta: todavía no es inventario a la venta
            'productos' => ProductoGeneral::query()
                ->whereIn('estado', [ProductoGeneral::ESTADO_DISPONIBLE, ProductoGeneral::ESTADO_VENDIDO])
                ->orderBy('tipo')->orderBy('nombre')->orderBy('modelo')->orderBy('id')
                ->get(['id', 'codigo', 'tipo', 'nombre', 'modelo', 'calidad', 'cantidad', 'precio_costo', 'precio_venta']),
            'ultimos' => $this->ultimosAjustes(),
        ]);
    }

    /**
     * Guarda el conteo: cada producto queda con lo que se contó y la diferencia va al historial.
     *
     * Cada renglón trae cuánto decía el sistema cuando se contó. Si mientras tanto se vendió algo, ese
     * renglón no se toca: ajustarlo con un conteo viejo «devolvería» lo que se acaba de vender. Se
     * avisa para que se vuelva a contar.
     */
    public function guardarConteo(Request $request)
    {
        $datos = $request->validate([
            'conteos'            => 'required|array|min:1|max:5000',
            'conteos.*.id'       => 'required|integer',
            'conteos.*.contado'  => 'required|integer|min:0|max:1000000',
            'conteos.*.esperado' => 'required|integer|min:0',
            'nota'               => 'nullable|string|max:120',
        ], [
            'conteos.required'           => 'Anota lo que contaste en al menos un producto.',
            'conteos.*.contado.required' => 'Falta lo que contaste en uno de los productos.',
            'conteos.*.contado.integer'  => 'Lo contado tiene que ser un número entero.',
            'conteos.*.contado.min'      => 'Lo contado no puede ser negativo.',
        ]);

        $motivo = 'Conteo físico del ' . now('America/La_Paz')->format('d/m/Y')
            . (($nota = trim((string) ($datos['nota'] ?? ''))) !== '' ? ' · ' . $nota : '');

        $resultado = DB::transaction(function () use ($datos, $motivo) {
            $r = ['contados' => 0, 'faltan' => 0, 'sobran' => 0, 'con_diferencia' => 0, 'cambiaron' => []];

            foreach ($datos['conteos'] as $fila) {
                $producto = StockPorCantidad::bloquear((int) $fila['id'], ProductoGeneral::class);

                if (! $producto || $producto->estado === ProductoGeneral::ESTADO_PERMUTA) {
                    continue;
                }

                if ($producto->cantidad !== (int) $fila['esperado']) {
                    $r['cambiaron'][] = $producto->etiqueta();

                    continue;
                }

                $r['contados']++;
                $movimiento = StockPorCantidad::ajustar($producto, (int) $fila['contado'], $motivo);

                if ($movimiento) {
                    $r['con_diferencia']++;
                    $r[$movimiento->cantidad < 0 ? 'faltan' : 'sobran'] += abs($movimiento->cantidad);
                }
            }

            return $r;
        });

        $unidades = fn (int $n, string $verbo) => $n === 1 ? "{$verbo} 1 unidad" : "{$verbo}n {$n} unidades";
        $diferencias = array_filter([
            $resultado['faltan'] ? $unidades($resultado['faltan'], 'falta') : null,
            $resultado['sobran'] ? $unidades($resultado['sobran'], 'sobra') : null,
        ]);

        $mensaje = "Se guardó el conteo de {$resultado['contados']} " . ($resultado['contados'] === 1 ? 'producto' : 'productos') . '. '
            . ($resultado['con_diferencia'] === 0
                ? 'Todo coincide con el sistema.'
                : "{$resultado['con_diferencia']} con diferencia: " . implode(' y ', $diferencias) . '. Quedó anotado en el historial de cada uno.');

        $redireccion = redirect()->route('admin.productos-generales.conteo')->with('success', $mensaje);

        if ($resultado['cambiaron'] !== []) {
            $redireccion->with('error', 'Mientras contabas se movió el saldo de ' . implode(', ', array_slice($resultado['cambiaron'], 0, 5))
                . (count($resultado['cambiaron']) > 5 ? ' y otros' : '') . '. Esos no se ajustaron: vuelve a contarlos.');
        }

        return $redireccion;
    }

    /** Marca varios productos como Nuevo o Seminuevo de una vez. */
    public function condicionMasiva(Request $request)
    {
        return $this->marcarCondicion($request, ProductoGeneral::class, 'un', 'producto', 'productos');
    }

    public function destroy(ProductoGeneral $producto)
    {
        if ($motivo = $this->bloqueo($producto)) {
            return back()->with('error', "No se puede eliminar. {$motivo}");
        }

        $producto->delete();

        return redirect()->route('admin.productos-generales.index')
            ->with('success', 'Producto eliminado correctamente.');
    }

    /** Lo que entrega un cliente en permuta: una unidad, que no se vende hasta habilitarla. */
    public function apiStore(Request $request)
    {
        $data = $request->validate([
            'codigo' => 'required|string|unique:productos_generales,codigo',
            'nombre' => 'required|string|max:255',
            'precio_costo' => 'required|numeric',
            'precio_venta' => 'required|numeric',
            'condicion' => CondicionInventario::regla(false),
        ], CondicionInventario::MENSAJES);

        $producto = new ProductoGeneral();
        $producto->codigo = $data['codigo'];
        $producto->nombre = $data['nombre'];
        $producto->precio_costo = $data['precio_costo'];
        $producto->precio_venta = $data['precio_venta'];
        $producto->estado = 'disponible';
        $producto->cantidad = 1;
        $producto->condicion = $data['condicion'] ?? null;

        // Campos por defecto para permutas
        $producto->tipo = 'permuta';
        $producto->procedencia = 'permuta';

        $producto->save();
        StockPorCantidad::registrarAlta($producto, 'Ingresó en permuta');

        return response()->json($producto);
    }

    public function habilitar(ProductoGeneral $producto)
    {
        if ($frenado = $this->frenarSiViaja($producto)) {
            return $frenado;
        }

        // Habilitar es para lo que llegó en permuta; uno agotado vuelve con «Ingresar»
        if ($producto->cantidad < 1) {
            return back()->with('error', "«{$producto->etiqueta()}» no tiene unidades: usa «Ingresar» cuando llegue mercadería.");
        }

        $producto->update(['estado' => 'disponible']);

        return back()->with('success', 'Producto habilitado para la venta.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function validar(Request $request, ?ProductoGeneral $producto = null): array
    {
        // El código se guarda en mayúsculas: así también se detectan repetidos escritos distinto
        if ($request->has('codigo')) {
            $codigo = mb_strtoupper(trim((string) $request->input('codigo')));
            $request->merge(['codigo' => $codigo === '' ? null : $codigo]);
        }

        // Los productos que llegaron en permuta conservan su tipo "permuta" al editarlos
        $tipos = $producto && ! in_array($producto->tipo, self::TIPOS, true) ? [...self::TIPOS, $producto->tipo] : self::TIPOS;

        $datos = $request->validate([
            // Al cargar es opcional (lo pone el sistema); al editar no se puede dejar vacío
            'codigo'        => [$producto ? 'required' : 'nullable', 'string', 'max:255',
                Rule::unique('productos_generales', 'codigo')->ignore($producto?->id)],
            'tipo'          => ['required', Rule::in($tipos)],
            'nombre'        => 'required|string|max:255',
            'modelo'        => 'nullable|string|max:120',
            'calidad'       => 'nullable|string|max:60',
            // Solo al cargar: después el saldo se mueve por «Ingresar», «Ajustar» o el conteo
            'cantidad'      => $producto ? 'exclude' : 'required|integer|min:1|max:1000000',
            'procedencia'   => 'required|string|max:100',
            'precio_costo'  => 'required|numeric|min:0|max:99999999.99',
            'precio_venta'  => 'required|numeric|min:0|max:99999999.99',
            // Opcional: sin precio para tiendas, no se vende a tiendas. Vacío queda null, nunca 0.
            'precio_tienda' => 'nullable|numeric|gt:0|max:99999999.99',
            'condicion'     => CondicionInventario::regla(),
        ], self::MENSAJES + CondicionInventario::MENSAJES);

        foreach (['modelo', 'calidad'] as $campo) {
            $datos[$campo] = trim((string) ($datos[$campo] ?? '')) ?: null;
        }

        return $datos;
    }

    /** Por qué no se puede eliminar: lo del inventario común, o que ya se usó en una reparación. */
    private function bloqueo(ProductoGeneral $producto): ?string
    {
        return $this->motivoBloqueo($producto)
            ?? (MovimientoProductoGeneral::where('producto_general_id', $producto->id)->where('tipo', MovimientoPieza::SERVICIO)->exists()
                ? 'Se usó en reparaciones y se conserva para no perder el historial.'
                : null);
    }

    /** Los últimos movimientos, ya listos para la pantalla. */
    private function movimientosDe(ProductoGeneral $producto): array
    {
        return $producto->movimientos()->with('usuario:id,name')->limit(60)->get()
            ->map(fn (MovimientoProductoGeneral $m) => [
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

    /** Lo último que se corrigió por conteo o ajuste: lo primero que mira quien audita. */
    private function ultimosAjustes(): array
    {
        return MovimientoProductoGeneral::query()
            ->where('tipo', MovimientoPieza::AJUSTE)
            ->whereHas('productoGeneral') // el filtro de sucursal viaja con el producto
            ->with(['productoGeneral:id,nombre,modelo,calidad,codigo', 'usuario:id,name'])
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(fn (MovimientoProductoGeneral $m) => [
                'id'       => $m->id,
                'producto' => $m->productoGeneral->etiqueta(),
                'codigo'   => $m->productoGeneral->codigo,
                'cantidad' => $m->cantidad,
                'saldo'    => $m->saldo,
                'motivo'   => $m->motivo,
                'quien'    => $m->usuario?->name,
                'fecha'    => $m->created_at?->toIso8601String(),
            ])->all();
    }

    /** Valores ya usados, para sugerirlos al escribir (los más frecuentes primero). */
    private function sugerencias(): array
    {
        $usados = fn (string $campo) => ProductoGeneral::query()
            ->whereNotNull($campo)
            ->whereNotIn($campo, ['', 'permuta'])
            ->groupBy($campo)
            ->orderByRaw('COUNT(*) DESC')
            ->limit(80)
            ->pluck($campo)
            ->values();

        return [
            'nombres'      => $usados('nombre'),
            'modelos'      => $usados('modelo'),
            'calidades'    => $usados('calidad'),
            'procedencias' => $usados('procedencia'),
        ];
    }
}
