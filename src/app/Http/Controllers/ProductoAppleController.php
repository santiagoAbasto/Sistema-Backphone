<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EquipoDeInventario;
use App\Models\ProductoApple;
use App\Support\CondicionInventario;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ProductoAppleController extends Controller
{
    use EquipoDeInventario;

    // Los valores que acepta la columna estado_imei
    private const ESTADOS_IMEI = [
        'Libre',
        'Registro seguro',
        'IMEI 1 libre y IMEI 2 registrado',
        'IMEI 2 libre y IMEI 1 registrado',
    ];

    private const MENSAJES = [
        'modelo.required'         => 'Escribe el modelo.',
        'modelo.max'              => 'El modelo puede tener hasta 255 caracteres.',
        'capacidad.max'           => 'La capacidad puede tener hasta 100 caracteres.',
        'color.required'          => 'Escribe el color.',
        'color.max'               => 'El color puede tener hasta 100 caracteres.',
        'bateria.max'             => 'La batería puede tener hasta 100 caracteres.',
        'numero_serie.unique'     => 'Ya hay un producto Apple con este número de serie.',
        'numero_serie.max'        => 'El número de serie puede tener hasta 100 caracteres.',
        'imei_1.required_if'      => 'Escribe el IMEI 1.',
        'imei_1.digits'           => 'El IMEI tiene 15 dígitos.',
        'imei_2.digits'           => 'El IMEI tiene 15 dígitos.',
        'imei_1.unique'           => 'Ya hay un producto Apple con este IMEI.',
        'imei_2.unique'           => 'Ya hay un producto Apple con este IMEI.',
        'imei_2.different'        => 'El IMEI 2 no puede ser igual al IMEI 1.',
        'estado_imei.required_if' => 'Elige el estado del IMEI.',
        'estado_imei.in'          => 'Elige el estado del IMEI.',
        'procedencia.required'    => 'Escribe de dónde llegó el producto.',
        'procedencia.max'         => 'La procedencia puede tener hasta 100 caracteres.',
        'precio_costo.required'   => 'Escribe el precio de costo.',
        'precio_venta.required'   => 'Escribe el precio de venta.',
        'precio_costo.numeric'    => 'Escribe un monto válido.',
        'precio_venta.numeric'    => 'Escribe un monto válido.',
        'precio_costo.min'        => 'El monto no puede ser negativo.',
        'precio_venta.min'        => 'El monto no puede ser negativo.',
        'precio_costo.max'        => 'El monto es demasiado grande.',
        'precio_venta.max'        => 'El monto es demasiado grande.',
        'estado.required'         => 'Elige el estado del producto.',
        'estado.in'               => 'Elige el estado del producto.',
    ];

    protected function inventario(): array
    {
        return ['tipo' => 'producto_apple', 'venta' => null, 'permuta' => 'entregado_producto_apple_id'];
    }

    public function index(Request $request)
    {
        if ($request->user()?->rol !== 'admin') {
            return redirect()->route('vendedor.productos.index');
        }

        return Inertia::render('Admin/ProductosApple/Index', [
            'productos'    => ProductoApple::query()
                ->orderByRaw("CASE estado WHEN 'disponible' THEN 0 WHEN 'permuta' THEN 1 ELSE 2 END")
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get(),
            'conHistorial' => $this->idsConHistorial(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/ProductosApple/Create', [
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function store(Request $request)
    {
        ProductoApple::create($this->validar($request));

        return redirect($this->destinoSeguro($request->input('return_to'), route('admin.productos-apple.index')))
            ->with('success', 'Equipo de marca registrado correctamente.');
    }

    public function show(ProductoApple $productoApple)
    {
        return redirect()->route('admin.productos-apple.edit', $productoApple);
    }

    public function edit(ProductoApple $productoApple)
    {
        return Inertia::render('Admin/ProductosApple/Edit', [
            'productoApple' => $productoApple,
            'historial'     => $this->historialDe($productoApple),
            'bloqueo'       => $this->motivoBloqueo($productoApple),
            'sugerencias'   => $this->sugerencias(),
        ]);
    }

    public function update(Request $request, ProductoApple $productoApple)
    {
        $productoApple->update($this->validar($request, $productoApple));

        return redirect()->route('admin.productos-apple.index')->with('success', 'Equipo de marca actualizado correctamente.');
    }

    /** Marca varios productos como Nuevo o Seminuevo de una vez. */
    public function condicionMasiva(Request $request)
    {
        return $this->marcarCondicion($request, ProductoApple::class, 'un', 'producto', 'productos');
    }

    public function habilitar(ProductoApple $productoApple)
    {
        $productoApple->update(['estado' => 'disponible']);

        return back()->with('success', 'Producto habilitado para la venta.');
    }

    public function destroy(ProductoApple $productoApple)
    {
        if ($motivo = $this->motivoBloqueo($productoApple)) {
            return back()->with('error', "No se puede eliminar. {$motivo}");
        }

        $productoApple->delete();

        return redirect()->route('admin.productos-apple.index')->with('success', 'Equipo de marca eliminado correctamente.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function validar(Request $request, ?ProductoApple $producto = null): array
    {
        $id = $producto?->id;
        $tieneImei = $request->boolean('tiene_imei');

        // Serie en mayúsculas (así se detectan repetidos escritos distinto); sin IMEI no se guardan IMEI sueltos.
        // Capacidad y batería vacías se guardan con "-", como en los registros anteriores.
        $request->merge([
            'numero_serie' => filled($request->input('numero_serie')) ? mb_strtoupper(trim((string) $request->input('numero_serie'))) : null,
            'capacidad'    => filled($request->input('capacidad')) ? trim((string) $request->input('capacidad')) : '-',
            'bateria'      => filled($request->input('bateria')) ? trim((string) $request->input('bateria')) : '-',
            'tiene_imei'   => $tieneImei,
            'estado'       => $request->input('estado', $producto?->estado ?? 'disponible'),
        ] + ($tieneImei ? [] : ['imei_1' => null, 'imei_2' => null, 'estado_imei' => null]));

        return $request->validate([
            'modelo'       => 'required|string|max:255',
            'capacidad'    => 'required|string|max:100',
            'color'        => 'required|string|max:100',
            'bateria'      => 'required|string|max:100',
            'numero_serie' => ['nullable', 'string', 'max:100', Rule::unique('productos_apple', 'numero_serie')->ignore($id)],
            'tiene_imei'   => 'required|boolean',
            'imei_1'       => ['nullable', 'required_if:tiene_imei,true', 'digits:15', Rule::unique('productos_apple', 'imei_1')->ignore($id)],
            'imei_2'       => ['nullable', 'digits:15', 'different:imei_1', Rule::unique('productos_apple', 'imei_2')->ignore($id)],
            'estado_imei'  => ['nullable', 'required_if:tiene_imei,true', Rule::in(self::ESTADOS_IMEI)],
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
        $usados = fn (string $campo) => ProductoApple::query()
            ->whereNotNull($campo)
            ->whereNotIn($campo, ['', '-', 'permuta'])
            ->groupBy($campo)
            ->orderByRaw('COUNT(*) DESC')
            ->limit(60)
            ->pluck($campo)
            ->values();

        return [
            'modelos'      => $usados('modelo'),
            'colores'      => $usados('color'),
            'procedencias' => $usados('procedencia'),
        ];
    }
}
