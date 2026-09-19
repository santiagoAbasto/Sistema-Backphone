<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EquipoDeInventario;
use App\Models\Celular;
use App\Support\CondicionInventario;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CelularController extends Controller
{
    use EquipoDeInventario;

    private const ESTADOS_IMEI = [
        Celular::ESTADO_IMEI_LIBRE,
        Celular::ESTADO_IMEI_REGISTRADO,
        Celular::ESTADO_IMEI1_LIBRE_IMEI2_REGISTRADO,
        Celular::ESTADO_IMEI1_REGISTRADO_IMEI2_LIBRE,
    ];

    private const MENSAJES = [
        'modelo.required'       => 'Escribe el modelo.',
        'modelo.max'            => 'El modelo puede tener hasta 255 caracteres.',
        'capacidad.required'    => 'Elige o escribe la capacidad.',
        'capacidad.max'         => 'La capacidad puede tener hasta 100 caracteres.',
        'color.required'        => 'Escribe el color.',
        'color.max'             => 'El color puede tener hasta 100 caracteres.',
        'bateria.max'           => 'La batería puede tener hasta 100 caracteres.',
        'imei_1.required'       => 'Escribe el IMEI 1.',
        'imei_1.digits'         => 'El IMEI tiene 15 dígitos.',
        'imei_2.digits'         => 'El IMEI tiene 15 dígitos.',
        'imei_1.unique'         => 'Ya hay un celular registrado con este IMEI.',
        'imei_2.unique'         => 'Ya hay un celular registrado con este IMEI.',
        'imei_2.different'      => 'El IMEI 2 no puede ser igual al IMEI 1.',
        'numero_serie.unique'   => 'Ya hay un celular con este número de serie.',
        'numero_serie.max'      => 'El número de serie puede tener hasta 100 caracteres.',
        'estado_imei.required'  => 'Elige el estado del IMEI.',
        'estado_imei.in'        => 'Elige el estado del IMEI.',
        'procedencia.required'  => 'Escribe de dónde llegó el equipo.',
        'procedencia.max'       => 'La procedencia puede tener hasta 100 caracteres.',
        'precio_costo.required' => 'Escribe el precio de costo.',
        'precio_venta.required' => 'Escribe el precio de venta.',
        'precio_costo.numeric'  => 'Escribe un monto válido.',
        'precio_venta.numeric'  => 'Escribe un monto válido.',
        'precio_costo.min'      => 'El monto no puede ser negativo.',
        'precio_venta.min'      => 'El monto no puede ser negativo.',
        'precio_costo.max'      => 'El monto es demasiado grande.',
        'precio_venta.max'      => 'El monto es demasiado grande.',
        'estado.required'       => 'Elige el estado del celular.',
        'estado.in'             => 'Elige el estado del celular.',
    ];

    protected function inventario(): array
    {
        return ['tipo' => 'celular', 'venta' => 'celular_id', 'permuta' => 'entregado_celular_id'];
    }

    public function index(Request $request)
    {
        // El vendedor tiene su propia pantalla de productos
        if ($request->user()?->rol !== 'admin') {
            return redirect()->route('vendedor.productos.index');
        }

        return Inertia::render('Admin/Celulares/Index', [
            'celulares'    => Celular::query()->ordenInventarioIphone()->get(),
            'conHistorial' => $this->idsConHistorial(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Celulares/Create', [
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function store(Request $request)
    {
        Celular::create($this->validar($request));

        return redirect($this->destinoSeguro($request->input('return_to'), route('admin.celulares.index')))
            ->with('success', 'Celular registrado correctamente.');
    }

    public function show(Celular $celular)
    {
        return redirect()->route('admin.celulares.edit', $celular);
    }

    public function edit(Celular $celular)
    {
        return Inertia::render('Admin/Celulares/Edit', [
            'celular'     => $celular,
            'historial'   => $this->historialDe($celular),
            'bloqueo'     => $this->motivoBloqueo($celular),
            'sugerencias' => $this->sugerencias(),
        ]);
    }

    public function update(Request $request, Celular $celular)
    {
        $celular->update($this->validar($request, $celular));

        return redirect()->route('admin.celulares.index')->with('success', 'Celular actualizado correctamente.');
    }

    /** Marca varios celulares como Nuevo o Seminuevo de una vez. */
    public function condicionMasiva(Request $request)
    {
        return $this->marcarCondicion($request, Celular::class, 'un', 'celular', 'celulares');
    }

    public function destroy(Celular $celular)
    {
        if ($motivo = $this->motivoBloqueo($celular)) {
            return back()->with('error', "No se puede eliminar. {$motivo}");
        }

        $celular->delete();

        return redirect()->route('admin.celulares.index')->with('success', 'Celular eliminado correctamente.');
    }

    public function apiStore(Request $request)
    {
        $data = $request->validate([
            'modelo' => 'required|string|max:255',
            'imei_1' => 'required|digits:15|unique:celulares,imei_1',
            'precio_costo' => 'required|numeric',
            'precio_venta' => 'required|numeric',
            'condicion' => CondicionInventario::regla(false),
        ], CondicionInventario::MENSAJES);

        $celular = new Celular();
        $celular->modelo = $data['modelo'];
        $celular->imei_1 = $data['imei_1'];
        $celular->precio_costo = $data['precio_costo'];
        $celular->precio_venta = $data['precio_venta'];
        $celular->estado = 'disponible';
        $celular->condicion = $data['condicion'] ?? null;
        $celular->capacidad = 'permuta';
        $celular->color = 'permuta';
        $celular->estado_imei = 'libre';
        $celular->procedencia = 'permuta';
        $celular->save();

        return response()->json($celular);
    }

    public function habilitar(Celular $celular)
    {
        $celular->update(['estado' => 'disponible']);

        return back()->with('success', 'Celular habilitado para la venta.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    private function validar(Request $request, ?Celular $celular = null): array
    {
        $id = $celular?->id;

        // Un IMEI no se repite: ni como IMEI 1 ni como IMEI 2 de otro equipo.
        // En equipos ya cargados solo se revisa si cambian sus IMEI (hay registros antiguos con cruces).
        $revisarCruces = ! $celular
            || (string) $request->input('imei_1') !== (string) $celular->imei_1
            || (string) $request->input('imei_2') !== (string) $celular->imei_2;

        $datos = $request->validate([
            'modelo'       => 'required|string|max:255',
            'capacidad'    => 'required|string|max:100',
            'color'        => 'required|string|max:100',
            'bateria'      => 'nullable|string|max:100',
            'imei_1'       => array_values(array_filter([
                'required',
                'digits:15',
                Rule::unique('celulares', 'imei_1')->ignore($id),
                $revisarCruces ? Rule::unique('celulares', 'imei_2')->ignore($id) : null,
            ])),
            'imei_2'       => array_values(array_filter([
                'nullable',
                'digits:15',
                $revisarCruces ? 'different:imei_1' : null,
                Rule::unique('celulares', 'imei_2')->ignore($id),
                $revisarCruces ? Rule::unique('celulares', 'imei_1')->ignore($id) : null,
            ])),
            'numero_serie' => ['nullable', 'string', 'max:100', Rule::unique('celulares', 'numero_serie')->ignore($id)],
            'estado_imei'  => ['required', Rule::in(self::ESTADOS_IMEI)],
            'procedencia'  => 'required|string|max:100',
            'precio_costo' => 'required|numeric|min:0|max:99999999.99',
            'precio_venta' => 'required|numeric|min:0|max:99999999.99',
            'estado'       => ['required', Rule::in([Celular::ESTADO_DISPONIBLE, Celular::ESTADO_VENDIDO, Celular::ESTADO_PERMUTA])],
            'condicion'    => CondicionInventario::regla(),
        ], self::MENSAJES + CondicionInventario::MENSAJES);

        if (array_key_exists('numero_serie', $datos)) {
            $datos['numero_serie'] = filled($datos['numero_serie']) ? mb_strtoupper($datos['numero_serie']) : null;
        }

        return $datos;
    }

    /** Valores ya usados, para sugerirlos al escribir (los más frecuentes primero). */
    private function sugerencias(): array
    {
        $usados = fn (string $campo) => Celular::query()
            ->whereNotNull($campo)
            ->where($campo, '<>', '')
            ->where($campo, '<>', 'permuta')
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
