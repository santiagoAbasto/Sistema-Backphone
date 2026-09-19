<?php

namespace App\Http\Controllers;

use App\Models\Egreso;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;

class EgresoController extends Controller
{
    /** Período pedido; por defecto, el mes en curso hasta hoy. */
    private function periodo(Request $request): array
    {
        $request->validate([
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
        ], [
            'fecha_fin.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.',
        ]);

        return [
            $request->input('fecha_inicio') ?? now()->startOfMonth()->toDateString(),
            $request->input('fecha_fin') ?? now()->toDateString(),
        ];
    }

    private function consultaDelPeriodo(string $fechaInicio, string $fechaFin)
    {
        return Egreso::with('user:id,name')
            ->whereBetween('created_at', [$fechaInicio . ' 00:00:00', $fechaFin . ' 23:59:59'])
            ->latest();
    }

    public function index(Request $request)
    {
        [$fechaInicio, $fechaFin] = $this->periodo($request);

        $egresos = $this->consultaDelPeriodo($fechaInicio, $fechaFin)->get();

        $totalGastado = $egresos->sum('precio_invertido');

        $tipoMasFrecuente = $egresos
            ->groupBy('tipo_gasto')
            ->map->count()
            ->sortDesc()
            ->keys()
            ->first();

        return Inertia::render('Admin/Egresos/Index', [
            'egresos' => $egresos,
            'filtros' => [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin,
            ],
            'resumen' => [
                'total_gastado' => $totalGastado,
                'tipo_mas_frecuente' => $tipoMasFrecuente,
                'cantidad_egresos' => $egresos->count(),
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Egresos/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'concepto' => 'required|string|max:255',
            'precio_invertido' => 'required|numeric|min:0.01|max:99999999.99',
            'tipo_gasto' => 'required|in:' . implode(',', array_keys(Egreso::TIPOS)),
            'frecuencia' => 'nullable|string|max:50',
            'cuotas_pendientes' => 'nullable|integer|min:0|max:255',
            'comentario' => 'nullable|string|max:255',
        ], [
            'concepto.required' => 'Escribe el concepto del egreso.',
            'precio_invertido.required' => 'Escribe el monto del egreso.',
            'precio_invertido.min' => 'El monto debe ser mayor a cero.',
            'tipo_gasto.required' => 'Elige el tipo de gasto.',
        ]);

        // Las cuotas pendientes solo tienen sentido en una cuota bancaria
        if ($validated['tipo_gasto'] !== 'cuota_bancaria') {
            $validated['cuotas_pendientes'] = null;
        }

        $validated['user_id'] = Auth::id();

        Egreso::create($validated);

        return redirect()->route('admin.egresos.index')->with('success', 'Egreso registrado correctamente.');
    }

    public function exportarPDF(Request $request)
    {
        [$fechaInicio, $fechaFin] = $this->periodo($request);
        $request->validate([
            'tipo_gasto' => 'nullable|in:' . implode(',', array_keys(Egreso::TIPOS)),
        ]);

        $egresos = $this->consultaDelPeriodo($fechaInicio, $fechaFin)
            ->when($request->filled('tipo_gasto'), fn ($q) => $q->where('tipo_gasto', $request->tipo_gasto))
            ->get();

        $totalGastado = $egresos->sum('precio_invertido');

        $pdf = Pdf::loadView('pdf.egresos', [
            'egresos' => $egresos,
            'total' => $totalGastado,
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
            'tipo' => $request->filled('tipo_gasto') ? Egreso::TIPOS[$request->tipo_gasto] : null,
        ])->setPaper('a4', 'portrait');

        return $pdf->stream('egresos_' . now()->format('Ymd_His') . '.pdf');
    }
}
