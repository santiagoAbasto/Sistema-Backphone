<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EquipoDeInventario;
use App\Models\ProductoGeneral;
use App\Support\CondicionInventario;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

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
        'estado.required'       => 'Elige el estado del producto.',
        'estado.in'             => 'Elige el estado del producto.',
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
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get(['id', 'codigo', 'tipo', 'nombre', 'procedencia', 'precio_costo', 'precio_venta', 'estado', 'condicion', 'created_at']),
            'conHistorial' => $this->idsConHistorial(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/ProductosGenerales/Create', [
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function store(Request $request)
    {
        ProductoGeneral::create($this->validar($request));

        return redirect($this->destinoSeguro($request->input('return_to'), route('admin.productos-generales.index')))
            ->with('success', 'Producto registrado correctamente.');
    }

    public function verificarCodigo(Request $request)
    {
        $codigo = mb_strtoupper(trim((string) $request->query('codigo')));

        return response()->json([
            'existe' => $codigo !== '' && ProductoGeneral::whereRaw('UPPER(codigo) = ?', [$codigo])->exists(),
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
            'historial'   => $this->historialDe($producto),
            'bloqueo'     => $this->motivoBloqueo($producto),
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function update(Request $request, ProductoGeneral $producto)
    {
        if ($frenado = $this->frenarSiViaja($producto)) {
            return $frenado;
        }

        $producto->update($this->validar($request, $producto));

        return redirect()->route('admin.productos-generales.index')
            ->with('success', 'Producto actualizado correctamente.');
    }

    /** Marca varios productos como Nuevo o Seminuevo de una vez. */
    public function condicionMasiva(Request $request)
    {
        return $this->marcarCondicion($request, ProductoGeneral::class, 'un', 'producto', 'productos');
    }

    public function destroy(ProductoGeneral $producto)
    {
        if ($motivo = $this->motivoBloqueo($producto)) {
            return back()->with('error', "No se puede eliminar. {$motivo}");
        }

        $producto->delete();

        return redirect()->route('admin.productos-generales.index')
            ->with('success', 'Producto eliminado correctamente.');
    }

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
        $producto->condicion = $data['condicion'] ?? null;

        // Campos por defecto para permutas
        $producto->tipo = 'permuta';
        $producto->procedencia = 'permuta';

        $producto->save();

        return response()->json($producto);
    }

    public function habilitar(ProductoGeneral $producto)
    {
        if ($frenado = $this->frenarSiViaja($producto)) {
            return $frenado;
        }

        $producto->update(['estado' => 'disponible']);

        return back()->with('success', 'Producto habilitado para la venta.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function validar(Request $request, ?ProductoGeneral $producto = null): array
    {
        // El código se guarda en mayúsculas: así también se detectan repetidos escritos distinto
        if ($request->has('codigo')) {
            $request->merge(['codigo' => mb_strtoupper(trim((string) $request->input('codigo')))]);
        }

        // Los productos que llegaron en permuta conservan su tipo "permuta" al editarlos
        $tipos = $producto && ! in_array($producto->tipo, self::TIPOS, true) ? [...self::TIPOS, $producto->tipo] : self::TIPOS;

        return $request->validate([
            'codigo'       => ['required', 'string', 'max:255', Rule::unique('productos_generales', 'codigo')->ignore($producto?->id)],
            'tipo'         => ['required', Rule::in($tipos)],
            'nombre'       => 'required|string|max:255',
            'procedencia'  => 'required|string|max:100',
            'precio_costo' => 'required|numeric|min:0|max:99999999.99',
            'precio_venta' => 'required|numeric|min:0|max:99999999.99',
            'estado'       => ['required', Rule::in(['disponible', 'vendido', 'permuta'])],
            'condicion'    => CondicionInventario::regla(),
        ], self::MENSAJES + CondicionInventario::MENSAJES);
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
            'procedencias' => $usados('procedencia'),
        ];
    }
}
