<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EquipoDeInventario;
use App\Models\Computadora;
use App\Support\CondicionInventario;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ComputadoraController extends Controller
{
    use EquipoDeInventario;

    private const MENSAJES = [
        'nombre.required'         => 'Escribe el nombre del equipo.',
        'nombre.max'              => 'El nombre puede tener hasta 255 caracteres.',
        'procesador.max'          => 'El chip o procesador puede tener hasta 100 caracteres.',
        'numero_serie.required'   => 'Escribe el número de serie.',
        'numero_serie.max'        => 'El número de serie puede tener hasta 100 caracteres.',
        'numero_serie.unique'     => 'Ya hay una computadora con este número de serie.',
        'color.required'          => 'Escribe el color.',
        'color.max'               => 'El color puede tener hasta 100 caracteres.',
        'bateria.max'             => 'La batería puede tener hasta 100 caracteres.',
        'ram.required'            => 'Elige o escribe la memoria RAM.',
        'ram.max'                 => 'La RAM puede tener hasta 50 caracteres.',
        'almacenamiento.required' => 'Elige o escribe el almacenamiento.',
        'almacenamiento.max'      => 'El almacenamiento puede tener hasta 100 caracteres.',
        'procedencia.required'    => 'Escribe de dónde llegó el equipo.',
        'procedencia.max'         => 'La procedencia puede tener hasta 100 caracteres.',
        'precio_costo.required'   => 'Escribe el precio de costo.',
        'precio_venta.required'   => 'Escribe el precio de venta.',
        'precio_costo.numeric'    => 'Escribe un monto válido.',
        'precio_venta.numeric'    => 'Escribe un monto válido.',
        'precio_costo.min'        => 'El monto no puede ser negativo.',
        'precio_venta.min'        => 'El monto no puede ser negativo.',
        'precio_costo.max'        => 'El monto es demasiado grande.',
        'precio_venta.max'        => 'El monto es demasiado grande.',
        'estado.required'         => 'Elige el estado de la computadora.',
        'estado.in'               => 'Elige el estado de la computadora.',
    ];

    protected function inventario(): array
    {
        return ['tipo' => 'computadora', 'venta' => 'computadora_id', 'permuta' => 'entregado_computadora_id'];
    }

    public function index(Request $request)
    {
        // El vendedor tiene su propia pantalla de productos
        if ($request->user()?->rol !== 'admin') {
            return redirect()->route('vendedor.productos.index');
        }

        return Inertia::render('Admin/Computadoras/Index', [
            'computadoras' => Computadora::query()
                ->orderByRaw("CASE estado WHEN 'disponible' THEN 0 WHEN 'permuta' THEN 1 ELSE 2 END")
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->get(),
            'conHistorial' => $this->idsConHistorial(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Computadoras/Create', [
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function store(Request $request)
    {
        Computadora::create($this->validar($request));

        return redirect($this->destinoSeguro($request->input('return_to'), route('admin.computadoras.index')))
            ->with('success', 'Computadora registrada correctamente.');
    }

    public function show(Computadora $computadora)
    {
        return redirect()->route('admin.computadoras.edit', $computadora);
    }

    public function edit(Computadora $computadora)
    {
        return Inertia::render('Admin/Computadoras/Edit', [
            'computadora' => $computadora,
            'historial'   => $this->historialDe($computadora),
            'bloqueo'     => $this->motivoBloqueo($computadora),
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function update(Request $request, Computadora $computadora)
    {
        $computadora->update($this->validar($request, $computadora));

        return redirect()->route('admin.computadoras.index')->with('success', 'Computadora actualizada correctamente.');
    }

    /** Marca varias computadoras como Nuevo o Seminuevo de una vez. */
    public function condicionMasiva(Request $request)
    {
        return $this->marcarCondicion($request, Computadora::class, 'una', 'computadora', 'computadoras');
    }

    public function destroy(Computadora $computadora)
    {
        if ($motivo = $this->motivoBloqueo($computadora)) {
            return back()->with('error', "No se puede eliminar. {$motivo}");
        }

        $computadora->delete();

        return redirect()->route('admin.computadoras.index')->with('success', 'Computadora eliminada correctamente.');
    }

    public function apiStore(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:255',
            'procesador' => 'nullable|string|max:100',
            'numero_serie' => 'required|string|unique:computadoras,numero_serie',
            'precio_costo' => 'required|numeric',
            'precio_venta' => 'required|numeric',
            'condicion' => CondicionInventario::regla(false),
        ], CondicionInventario::MENSAJES);

        $computadora = new Computadora();
        $computadora->nombre = $data['nombre'];
        $computadora->procesador = $data['procesador'] ?? 'permuta';
        $computadora->numero_serie = $data['numero_serie'];
        $computadora->precio_costo = $data['precio_costo'];
        $computadora->precio_venta = $data['precio_venta'];
        $computadora->estado = 'disponible';
        $computadora->condicion = $data['condicion'] ?? null;

        // Campos opcionales
        $computadora->color = 'permuta';
        $computadora->bateria = null;
        $computadora->ram = 'permuta';
        $computadora->almacenamiento = 'permuta';
        $computadora->procedencia = 'permuta';

        $computadora->save();

        return response()->json($computadora);
    }

    public function habilitar(Computadora $computadora)
    {
        $computadora->update(['estado' => 'disponible']);

        return back()->with('success', 'Computadora habilitada para la venta.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function validar(Request $request, ?Computadora $computadora = null): array
    {
        // El número de serie se guarda en mayúsculas: así también se detectan repetidos escritos distinto
        if ($request->has('numero_serie')) {
            $request->merge(['numero_serie' => mb_strtoupper(trim((string) $request->input('numero_serie')))]);
        }

        return $request->validate([
            'nombre'         => 'required|string|max:255',
            'procesador'     => 'nullable|string|max:100',
            'numero_serie'   => ['required', 'string', 'max:100', Rule::unique('computadoras', 'numero_serie')->ignore($computadora?->id)],
            'color'          => 'required|string|max:100',
            'bateria'        => 'nullable|string|max:100',
            'ram'            => 'required|string|max:50',
            'almacenamiento' => 'required|string|max:100',
            'procedencia'    => 'required|string|max:100',
            'precio_costo'   => 'required|numeric|min:0|max:99999999.99',
            'precio_venta'   => 'required|numeric|min:0|max:99999999.99',
            'estado'         => ['required', Rule::in(['disponible', 'vendido', 'permuta'])],
            'condicion'      => CondicionInventario::regla(),
        ], self::MENSAJES + CondicionInventario::MENSAJES);
    }

    /** Valores ya usados, para sugerirlos al escribir (los más frecuentes primero). */
    private function sugerencias(): array
    {
        $usados = fn (string $campo) => Computadora::query()
            ->whereNotNull($campo)
            ->where($campo, '<>', '')
            ->where($campo, '<>', 'permuta')
            ->groupBy($campo)
            ->orderByRaw('COUNT(*) DESC')
            ->limit(60)
            ->pluck($campo)
            ->values();

        return [
            'nombres'      => $usados('nombre'),
            'procesadores' => $usados('procesador'),
            'colores'      => $usados('color'),
            'procedencias' => $usados('procedencia'),
        ];
    }
}
