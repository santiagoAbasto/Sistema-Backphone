<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Liquidacion;
use App\Models\ServicioTecnico;
use App\Models\Tecnico;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Técnicos y comisiones.
 *
 * El taller no paga sueldo: reparte la ganancia de cada reparación. Esta pantalla hace las dos
 * cosas que eso necesita — llevar la ficha de cada técnico (a qué se dedica y con qué porcentaje
 * cobra) y decir, semana por semana, cuánto le toca.
 *
 * El número es una sugerencia hasta que alguien la paga. Al pagarla se guarda el cálculo entero,
 * y a partir de ahí ya no cambia aunque después se corrija un costo de esa semana.
 */
class TecnicoController extends Controller
{
    private const ZONA = 'America/La_Paz';

    private const MENSAJES = [
        'nombre.required'       => 'Escribe el nombre del técnico.',
        'nombre.max'            => 'El nombre puede tener hasta 120 caracteres.',
        'especialidad.required' => 'Elige a qué equipos se dedica.',
        'especialidad.in'       => 'Elige a qué equipos se dedica.',
        'comision.required'     => 'Escribe qué porcentaje se lleva el técnico.',
        'comision.integer'      => 'El porcentaje tiene que ser un número entero.',
        'comision.min'          => 'El porcentaje no puede ser negativo.',
        'comision.max'          => 'El porcentaje no puede pasar de 100.',
    ];

    public function index(Request $request)
    {
        $request->validate(['semana' => 'nullable|date']);

        [$inicio, $fin] = $this->semanaDe($request->string('semana')->toString() ?: null);

        return Inertia::render('Admin/Tecnicos/Index', [
            'tecnicos'       => $this->fichas(),
            'semana'         => [
                'inicio'    => $inicio->toDateString(),
                'fin'       => $fin->toDateString(),
                'esActual'  => $inicio->isSameWeek(Carbon::now(self::ZONA)),
                'anterior'  => $inicio->copy()->subWeek()->toDateString(),
                'siguiente' => $inicio->copy()->addWeek()->toDateString(),
            ],
            'comisiones'     => $this->comisionesDeLaSemana($inicio, $fin),
            // Servicios de la semana que nadie tiene asignados. No se reparten ni se pierden:
            // se avisan, para que el administrador los complete antes de pagar.
            'sinTecnico'     => ServicioTecnico::whereNull('tecnico_id')
                ->whereBetween('fecha', [$inicio->toDateString(), $fin->toDateString()])
                ->count(),
            'especialidades' => collect(Tecnico::ESPECIALIDADES)
                ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        $tecnico = Tecnico::create($this->validar($request));

        return back()->with('success', "{$tecnico->nombre} quedó registrado con {$tecnico->comision} % de comisión.");
    }

    public function update(Request $request, Tecnico $tecnico)
    {
        $tecnico->update($this->validar($request));

        return back()->with('success', 'Ficha del técnico actualizada.');
    }

    /**
     * Un técnico que ya reparó algo no se borra: se archiva.
     *
     * Borrarlo dejaría servicios pagados apuntando a nadie, y con eso se cae la trazabilidad de
     * lo que se liquidó. Archivado deja de aparecer al registrar un servicio y nada más.
     */
    public function destroy(Tecnico $tecnico)
    {
        if ($tecnico->servicios()->exists()) {
            $tecnico->update(['activo' => false]);

            return back()->with('success', "{$tecnico->nombre} quedó archivado: ya no aparece al registrar un servicio, pero su historial se conserva.");
        }

        $tecnico->delete();

        return back()->with('success', 'Técnico eliminado.');
    }

    /** Se le pagó la semana. Queda guardado el cálculo entero, no solo el monto. */
    public function liquidar(Request $request, Tecnico $tecnico)
    {
        $datos = $request->validate([
            'semana' => 'required|date',
        ]);

        [$inicio, $fin] = $this->semanaDe($datos['semana']);

        $resumen = collect($this->comisionesDeLaSemana($inicio, $fin))
            ->firstWhere('tecnico_id', $tecnico->id);

        if (! $resumen || $resumen['servicios'] === 0) {
            return back()->with('error', 'Esa semana no tiene servicios de este técnico.');
        }

        if ($resumen['pendientes'] > 0) {
            return back()->with('error', 'Faltan cargar costos de esa semana: sin eso no se sabe cuánto le toca.');
        }

        Liquidacion::updateOrCreate(
            ['tecnico_id' => $tecnico->id, 'semana_inicio' => $inicio->toDateString()],
            [
                'sucursal_id'   => $tecnico->sucursal_id,
                'semana_fin'    => $fin->toDateString(),
                'servicios'     => $resumen['servicios'],
                'cobrado'       => $resumen['cobrado'],
                'repuestos'     => $resumen['repuestos'],
                'ganancia'      => $resumen['ganancia'],
                'porcentaje'    => $tecnico->comision,
                'monto'         => $resumen['comision'],
                'pagada_por'    => $request->user()->id,
            ]
        );

        return back()->with('success', "Semana pagada a {$tecnico->nombre}: Bs " . number_format($resumen['comision'], 2) . '.');
    }

    // ─── Apoyo ───────────────────────────────────────────────────────────────

    /** El lunes y el domingo de la semana que contiene esa fecha. */
    private function semanaDe(?string $fecha): array
    {
        $referencia = $fecha ? Carbon::parse($fecha, self::ZONA) : Carbon::now(self::ZONA);

        return [
            $referencia->copy()->startOfWeek(Carbon::MONDAY)->startOfDay(),
            $referencia->copy()->endOfWeek(Carbon::SUNDAY)->endOfDay(),
        ];
    }

    private function fichas(): array
    {
        return Tecnico::query()
            ->withCount('servicios')
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->get()
            ->map(fn (Tecnico $t) => [
                'id'                => $t->id,
                'nombre'            => $t->nombre,
                'especialidad'      => $t->especialidad,
                'especialidadTexto' => $t->especialidad_texto,
                'comision'          => $t->comision,
                'telefono'          => $t->telefono,
                'notas'             => $t->notas,
                'activo'            => $t->activo,
                'servicios'         => $t->servicios_count,
            ])->all();
    }

    /**
     * Lo que le toca a cada técnico por la semana.
     *
     * Aparecen todos los técnicos activos, aunque no hayan reparado nada: una semana en cero es
     * un dato, no una fila que falta. Los servicios a los que les falta el costo se cuentan
     * aparte y no entran en el monto, porque sin costo no hay ganancia que repartir.
     */
    private function comisionesDeLaSemana(Carbon $inicio, Carbon $fin): array
    {
        $servicios = ServicioTecnico::query()
            ->whereNotNull('tecnico_id')
            ->whereBetween('fecha', [$inicio->toDateString(), $fin->toDateString()])
            ->get()
            ->groupBy('tecnico_id');

        $pagadas = Liquidacion::with('quienPago:id,name')
            ->where('semana_inicio', $inicio->toDateString())
            ->get()
            ->keyBy('tecnico_id');

        return Tecnico::query()
            ->where(fn ($q) => $q->where('activo', true)->orWhereIn('id', $servicios->keys()))
            ->orderBy('nombre')
            ->get()
            ->map(function (Tecnico $tecnico) use ($servicios, $pagadas) {
                $suyos = $servicios->get($tecnico->id, collect());
                $conCosto = $suyos->where('costo_pendiente', false);
                $liquidacion = $pagadas->get($tecnico->id);

                $cobrado   = round((float) $conCosto->sum('precio_venta'), 2);
                $repuestos = round((float) $conCosto->sum(fn ($s) => $s->costoParaReportes()), 2);
                $ganancia  = round((float) $conCosto->sum(fn ($s) => max(0.0, $s->gananciaParaReportes())), 2);
                $comision  = round((float) $conCosto->sum(fn ($s) => $s->comisionDelTecnico() ?? 0), 2);

                return [
                    'tecnico_id'   => $tecnico->id,
                    'nombre'       => $tecnico->nombre,
                    'especialidad' => $tecnico->especialidad,
                    'porcentaje'   => $tecnico->comision,
                    'activo'       => $tecnico->activo,
                    'servicios'    => $conCosto->count(),
                    'pendientes'   => $suyos->where('costo_pendiente', true)->count(),
                    'cobrado'      => $cobrado,
                    'repuestos'    => $repuestos,
                    'ganancia'     => $ganancia,
                    'comision'     => $comision,
                    'tienda'       => round($ganancia - $comision, 2),
                    'notas'        => $conCosto->sortBy('id')->map(fn ($s) => [
                        'codigo'   => $s->codigo_nota,
                        'equipo'   => $s->equipo,
                        'cobrado'  => (float) $s->precio_venta,
                        'comision' => $s->comisionDelTecnico(),
                    ])->values()->all(),
                    'pagada'       => $liquidacion ? [
                        'monto' => (float) $liquidacion->monto,
                        'quien' => $liquidacion->quienPago?->name,
                        'fecha' => $liquidacion->created_at?->toIso8601String(),
                    ] : null,
                ];
            })->values()->all();
    }

    private function validar(Request $request): array
    {
        $datos = $request->validate([
            'nombre'       => 'required|string|max:120',
            'especialidad' => ['required', Rule::in(array_keys(Tecnico::ESPECIALIDADES))],
            'comision'     => 'required|integer|min:0|max:100',
            'telefono'     => 'nullable|string|max:40',
            'notas'        => 'nullable|string|max:2000',
            'activo'       => 'nullable|boolean',
        ], self::MENSAJES);

        $datos['activo'] = $request->boolean('activo', true);
        $datos['telefono'] = trim((string) ($datos['telefono'] ?? '')) ?: null;
        $datos['notas'] = trim((string) ($datos['notas'] ?? '')) ?: null;

        return $datos;
    }
}
