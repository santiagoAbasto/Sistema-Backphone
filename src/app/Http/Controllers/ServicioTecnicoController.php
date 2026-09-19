<?php

namespace App\Http\Controllers;

use App\Models\ServicioTecnico;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use App\Services\GeneradorCodigos;
use App\Models\Cliente;
use App\Support\SinCostos;


class ServicioTecnicoController extends Controller
{
    private function authorizeServicioAccess(ServicioTecnico $servicio): void
    {
        if (Auth::user()->rol === 'vendedor' && (int) $servicio->user_id !== (int) Auth::id()) {
            abort(404);
        }
    }

    /** Técnicos ya usados en servicios anteriores (para filtrar y elegir rápido). */
    private function tecnicosConocidos()
    {
        return ServicioTecnico::query()
            ->whereNotNull('tecnico')
            ->where('tecnico', '<>', '')
            ->distinct()
            ->orderBy('tecnico')
            ->pluck('tecnico')
            ->values();
    }

    /* ======================================================
     * INDEX
     * ====================================================== */
    public function index(Request $request)
    {
        $request->validate([
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
            'vendedor_id' => 'nullable|exists:users,id',
            'tecnico' => 'nullable|string|max:120',
            'buscar' => 'nullable|string',
            'pendientes' => 'nullable|boolean',
        ]);

        $esAdmin = ! SinCostos::aplica(Auth::user());
        $query = ServicioTecnico::with(['vendedor', 'quienCargoElCosto:id,name'])->orderByDesc('fecha')->orderByDesc('id');

        // «Sin costo»: los servicios que el administrador todavía tiene que completar
        if ($esAdmin && $request->boolean('pendientes')) {
            $query->sinCosto();
        }

        if (Auth::user()->rol === 'vendedor') {
            $query->where('user_id', Auth::id());
        } elseif ($request->filled('vendedor_id')) {
            $query->where('user_id', $request->vendedor_id);
        }

        if ($request->filled('fecha_inicio') && $request->filled('fecha_fin')) {
            $query->whereBetween('fecha', [$request->fecha_inicio, $request->fecha_fin]);
        }

        if ($request->filled('tecnico')) {
            $query->where('tecnico', $request->tecnico);
        }

        if ($request->filled('buscar')) {
            $query->where(function ($q) use ($request) {
                $q->where('cliente', 'like', '%' . $request->buscar . '%')
                    ->orWhere('codigo_nota', 'like', '%' . $request->buscar . '%');
            });

            // Al vendedor tampoco le viaja el costo por la búsqueda rápida
            return response()->json([
                'servicios' => $esAdmin ? $query->get() : $this->sinCostos($query->get()),
            ]);
        }

        return Inertia::render(
            Auth::user()->rol === 'admin'
                ? 'Admin/Servicios/Index'
                : 'Vendedor/Servicios/Index',
            [
                // Al vendedor no le viajan ni el costo del servicio ni el de cada trabajo
                'servicios' => $esAdmin ? $query->get() : $this->sinCostos($query->get()),
                'filtros' => $request->only(['fecha_inicio', 'fecha_fin', 'vendedor_id', 'tecnico', 'pendientes']),
                // Cuántos servicios esperan su costo, sin importar el período que se esté mirando
                'pendientesDeCosto' => $esAdmin ? ServicioTecnico::sinCosto()->count() : 0,
                // Quienes registraron al menos un servicio (filtro «Registrado por»)
                'vendedores' => $esAdmin
                    ? \App\Models\User::whereIn('id', ServicioTecnico::query()->select('user_id'))
                        ->orderBy('name')
                        ->get(['id', 'name'])
                    : [],
                // Los técnicos conocidos sirven en los dos paneles para autocompletar y filtrar
                'tecnicos' => $this->tecnicosConocidos(),
            ]
        );
    }

    /* ======================================================
     * CREATE
     * ====================================================== */
    public function create()
    {
        return Inertia::render(
            Auth::user()->rol === 'admin' ? 'Admin/Servicios/Create' : 'Vendedor/Servicios/Create',
            ['tecnicos' => $this->tecnicosConocidos()]
        );
    }

    /* ======================================================
     * STORE
     * ====================================================== */
    public function store(Request $request)
    {
        $data = $request->validate([
            'cliente'           => 'required|string|max:255',
            'telefono'          => 'nullable|string|max:50',
            'equipo'            => 'required|string|max:255',
            'detalle_servicio'  => 'required|string',
            'notas_adicionales' => 'nullable|string',
            // El costo solo lo carga el administrador: al vendedor se le ignora aunque lo mande
            'precio_costo'      => 'nullable|numeric|min:0',
            'precio_venta'      => 'required|numeric|min:0',
            'tecnico'           => 'required|string|max:120',
            'fecha'             => 'nullable|date',
        ]);

        $esAdmin = ! SinCostos::aplica(Auth::user());
        $montos = $this->montosDelServicio($data, $esAdmin);

        return DB::transaction(function () use ($data, $montos, $esAdmin) {

            $cliente = Cliente::firstOrCreate(
                [
                    'user_id' => auth()->id(),
                    'nombre'  => $data['cliente'],
                ],
                [
                    'telefono' => $data['telefono'] ?? null,
                ]
            );

            $servicio = null;

            GeneradorCodigos::crearServicioTecnicoConCodigo(function (string $codigo) use ($cliente, $data, $montos, &$servicio) {
                $servicio = ServicioTecnico::create([
                    'codigo_nota'       => $codigo,
                    'cliente_id'        => $cliente->id,
                    'cliente'           => $cliente->nombre,
                    'telefono'          => $cliente->telefono,
                    'equipo'            => $data['equipo'],
                    'detalle_servicio'  => $montos['detalle'],
                    'notas_adicionales' => $data['notas_adicionales'] ?? null,
                    'precio_costo'      => $montos['costo'],
                    'precio_venta'      => $montos['venta'],
                    'costo_pendiente'   => $montos['pendiente'],
                    'costo_cargado_por' => $montos['pendiente'] ? null : auth()->id(),
                    'costo_cargado_en'  => $montos['pendiente'] ? null : now(),
                    'tecnico'           => $data['tecnico'],
                    'fecha'             => $data['fecha'] ?? now('America/La_Paz'),
                    'user_id'           => auth()->id(),
                ]);
            });

            // Lo que registra el vendedor llega al administrador en el momento: tiene que cargar el costo
            if ($servicio && $montos['pendiente'] && ! $esAdmin) {
                $servicio->load('vendedor')->avisarCostoPendiente();
            }

            return redirect()
                ->route($esAdmin ? 'admin.servicios.index' : 'vendedor.servicios.index')
                ->with('success', $montos['pendiente'] && ! $esAdmin
                    ? 'Servicio técnico registrado. Ya puedes imprimir la nota.'
                    : 'Servicio técnico registrado correctamente.');
        });
    }

    /* ======================================================
     * COSTO DEL SERVICIO (solo el administrador)
     * ====================================================== */
    public function cargarCosto(Request $request, ServicioTecnico $servicio)
    {
        abort_if(SinCostos::aplica(Auth::user()), 403, 'Solo el administrador carga el costo de un servicio técnico.');

        $trabajos = $servicio->trabajos();

        if ($trabajos !== null && count($trabajos) > 0) {
            $validated = $request->validate([
                'costos'   => ['required', 'array', 'size:' . count($trabajos)],
                'costos.*' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            ], [
                'costos.size'       => 'Carga el costo de cada trabajo del servicio.',
                'costos.*.required' => 'Carga el costo de cada trabajo del servicio.',
                'costos.*.numeric'  => 'El costo tiene que ser un monto.',
                'costos.*.min'      => 'El costo no puede ser negativo.',
            ]);

            // Solo se completa el costo: la descripción y lo que paga el cliente (lo que dice la nota) no cambian
            foreach ($trabajos as $i => $trabajo) {
                $trabajos[$i] = is_array($trabajo) ? $trabajo : ['descripcion' => (string) $trabajo];
                $trabajos[$i]['costo'] = round((float) $validated['costos'][$i], 2);
            }

            $costo = round(array_sum(array_column($trabajos, 'costo')), 2);
            $servicio->detalle_servicio = json_encode($trabajos, JSON_UNESCAPED_UNICODE);
        } else {
            // Registros antiguos con el detalle en texto libre: un solo costo total
            $validated = $request->validate([
                'costo_total' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            ], [
                'costo_total.required' => 'Carga el costo del servicio.',
            ]);
            $costo = round((float) $validated['costo_total'], 2);
        }

        $servicio->fill([
            'precio_costo'      => $costo,
            'costo_pendiente'   => false,
            'costo_cargado_por' => Auth::id(),
            'costo_cargado_en'  => now(),
        ])->save();

        // El aviso del Resumen ya cumplió su tarea
        if (\Illuminate\Support\Facades\Schema::hasColumn('system_notifications', 'servicio_tecnico_id')) {
            \App\Models\SystemNotification::where('servicio_tecnico_id', $servicio->id)->update(['read' => true]);
        }

        $ganancia = (float) $servicio->precio_venta - $costo;

        return back()->with('success', "Costo cargado en {$servicio->codigo_nota}: "
            . ($ganancia < 0 ? 'se cobró Bs ' . number_format(abs($ganancia), 2) . ' menos de lo que costó.' : 'deja una utilidad de Bs ' . number_format($ganancia, 2) . '.'));
    }

    /**
     * Los montos del servicio salen de sus trabajos, no del total que manda el navegador: así la nota, el total y la
     * utilidad siempre cuadran. El vendedor registra solo lo que paga el cliente; si el administrador deja algún costo
     * vacío, el servicio queda con el costo pendiente igual que uno del vendedor.
     */
    private function montosDelServicio(array $data, bool $esAdmin): array
    {
        $items = json_decode($data['detalle_servicio'], true);

        if (! is_array($items)) {
            $pendiente = ! $esAdmin || ! isset($data['precio_costo']);

            return [
                'detalle'   => $data['detalle_servicio'],
                'venta'     => round((float) $data['precio_venta'], 2),
                'costo'     => $pendiente ? 0 : round((float) $data['precio_costo'], 2),
                'pendiente' => $pendiente,
            ];
        }

        $trabajos = [];
        $errores = [];

        foreach (array_values($items) as $i => $item) {
            $descripcion = trim(strip_tags((string) ($item['descripcion'] ?? '')));

            if ($descripcion === '') {
                continue;
            }

            $precio = $item['precio'] ?? null;
            if (! is_numeric($precio) || (float) $precio < 0) {
                $errores['detalle_servicio'] = "Revisa lo que paga el cliente por «{$descripcion}».";
                continue;
            }

            $trabajo = ['descripcion' => $descripcion, 'precio' => round((float) $precio, 2)];

            $costo = $item['costo'] ?? null;
            if ($esAdmin && $costo !== null && $costo !== '') {
                if (! is_numeric($costo) || (float) $costo < 0) {
                    $errores['detalle_servicio'] = "Revisa el costo de «{$descripcion}».";
                    continue;
                }
                $trabajo['costo'] = round((float) $costo, 2);
            }

            $trabajos[] = $trabajo;
        }

        if ($trabajos === [] && $errores === []) {
            $errores['detalle_servicio'] = 'Agrega al menos un trabajo.';
        }

        if ($errores !== []) {
            throw \Illuminate\Validation\ValidationException::withMessages($errores);
        }

        $pendiente = ! $esAdmin || collect($trabajos)->contains(fn (array $t) => ! array_key_exists('costo', $t));

        return [
            'detalle'   => json_encode($trabajos, JSON_UNESCAPED_UNICODE),
            'venta'     => round(array_sum(array_column($trabajos, 'precio')), 2),
            'costo'     => round(array_sum(array_column($trabajos, 'costo')), 2),
            'pendiente' => $pendiente,
        ];
    }

    /** Servicios listos para el panel del vendedor: sin el costo del servicio ni el de cada trabajo. */
    private function sinCostos($servicios)
    {
        return SinCostos::deColeccion($servicios)->map(function (array $s) {
            $s['detalle_servicio'] = SinCostos::detalleDeServicio($s['detalle_servicio'] ?? null);

            return $s;
        })->values();
    }

    /* ======================================================
     * EXPORTACIONES BASE
     * ====================================================== */
    public function exportar(Request $request)
    {
        return $this->generarPDF(
            ServicioTecnico::with('vendedor')->orderByDesc('fecha')->get()
        );
    }

    public function exportarDia()
    {
        return $this->generarPDF(
            ServicioTecnico::whereDate('fecha', Carbon::now('America/La_Paz'))->get()
        );
    }

    public function exportarSemana()
    {
        return $this->generarPDF(
            ServicioTecnico::whereBetween('fecha', [
                Carbon::now('America/La_Paz')->startOfWeek(),
                Carbon::now('America/La_Paz')->endOfWeek()
            ])->get()
        );
    }

    public function exportarMes()
    {
        return $this->generarPDF(
            ServicioTecnico::whereBetween('fecha', [
                Carbon::now('America/La_Paz')->startOfMonth(),
                Carbon::now('America/La_Paz')->endOfMonth()
            ])->get()
        );
    }

    public function exportarAnio()
    {
        return $this->generarPDF(
            ServicioTecnico::whereBetween('fecha', [
                Carbon::now('America/La_Paz')->startOfYear(),
                Carbon::now('America/La_Paz')->endOfYear()
            ])->get()
        );
    }

    private function generarPDF($servicios)
    {
        return Pdf::loadView('pdf.servicios_tecnicos', compact('servicios'))
            ->setPaper('A4', 'portrait')
            ->download('reporte_servicios.pdf');
    }

    /* ======================================================
     * NORMALIZADOR (CORREGIDO)
     * ====================================================== */
    private function normalizarServiciosParaExport($servicios)
    {
        $filas = collect();

        foreach ($servicios as $servicio) {

            $items = json_decode($servicio->detalle_servicio, true);

            if (!is_array($items)) {
                continue;
            }

            foreach ($items as $item) {

                // Sin costo cargado no se inventa uno: el PDF dice «Pendiente» y no lo suma
                $costoReal = $servicio->costo_pendiente
                    ? null
                    : (isset($item['costo']) ? (float) $item['costo'] : (float) $servicio->precio_costo);

                $filas->push([
                    'codigo_nota' => $servicio->codigo_nota,
                    'cliente'     => $servicio->cliente,
                    'equipo'      => $servicio->equipo,
                    'servicio'    => $item['descripcion'] ?? '—',
                    'costo'       => $costoReal,
                    'pendiente'   => (bool) $servicio->costo_pendiente,
                    'venta'       => (float) ($item['precio'] ?? 0),
                    'tecnico'     => $servicio->tecnico,
                    'vendedor'    => optional($servicio->vendedor)->name ?? '—',
                    'fecha'       => $servicio->fecha,
                ]);
            }
        }

        return $filas;
    }


    /* ======================================================
     * EXPORTAR FILTRADO / RESUMEN
     * ====================================================== */
    public function exportarFiltrado(Request $request)
    {
        $request->validate([
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date',
            'tecnico' => 'nullable|string|max:120',
        ]);

        $query = ServicioTecnico::with('vendedor')->orderByDesc('fecha')->orderByDesc('id');

        if (Auth::user()->rol === 'vendedor') {
            $query->where('user_id', Auth::id());
        }

        if ($request->filled('vendedor_id')) {
            $query->where('user_id', $request->vendedor_id);
        }

        if ($request->filled('fecha_inicio') && $request->filled('fecha_fin')) {
            $query->whereBetween('fecha', [$request->fecha_inicio, $request->fecha_fin]);
        }

        if ($request->filled('tecnico')) {
            $query->where('tecnico', $request->tecnico);
        }

        $filas = $this->normalizarServiciosParaExport($query->get());
        $periodo = $this->descripcionFiltros($request);
        $conCostos = ! SinCostos::aplica(Auth::user());

        return Pdf::loadView('pdf.servicios_tecnicos_resumen', compact('filas', 'periodo', 'conCostos'))
            ->setPaper('A4', 'landscape')
            ->download('servicios_tecnicos_filtrado.pdf');
    }

    /** Encabezado del PDF: qué período y filtros incluye el reporte. */
    private function descripcionFiltros(Request $request): string
    {
        $partes = [
            $request->filled('fecha_inicio') && $request->filled('fecha_fin')
                ? 'Del ' . Carbon::parse($request->fecha_inicio)->format('d/m/Y') . ' al ' . Carbon::parse($request->fecha_fin)->format('d/m/Y')
                : 'Todas las fechas',
        ];

        if ($request->filled('tecnico')) {
            $partes[] = 'Técnico: ' . $request->tecnico;
        }

        if (Auth::user()->rol === 'admin' && $request->filled('vendedor_id')) {
            $nombre = \App\Models\User::whereKey($request->vendedor_id)->value('name');
            if ($nombre) {
                $partes[] = 'Registrado por: ' . $nombre;
            }
        }

        return implode(' · ', $partes);
    }

    public function exportarResumen(Request $request)
    {
        $request->validate([
            'fecha_inicio' => 'nullable|date',
            'fecha_fin'    => 'nullable|date|after_or_equal:fecha_inicio',
        ]);

        // Sin fechas se toma el mes en curso: así el PDF nunca sale vacío por un parámetro que falta
        $desde = $request->input('fecha_inicio') ?: now()->startOfMonth()->toDateString();
        $hasta = $request->input('fecha_fin') ?: now()->endOfMonth()->toDateString();

        $servicios = ServicioTecnico::with('vendedor')
            ->when(Auth::user()->rol === 'vendedor', fn($q) => $q->where('user_id', Auth::id()))
            ->whereBetween('fecha', [$desde, $hasta])
            ->orderByDesc('fecha')
            ->get();

        $filas = $this->normalizarServiciosParaExport($servicios);
        $conCostos = ! SinCostos::aplica(Auth::user());

        return Pdf::loadView('pdf.servicios_tecnicos_resumen', compact('filas', 'conCostos'))
            ->setPaper('A4', 'landscape')
            ->stream('servicios_tecnicos_resumen.pdf');
    }

    /* ======================================================
     * BOLETA / RECIBO
     * ====================================================== */
    public function boleta(ServicioTecnico $servicio)
    {
        $this->authorizeServicioAccess($servicio);

        $servicio->load('vendedor');

        $servicios_cliente = collect(json_decode($servicio->detalle_servicio, true))
            ->filter(fn($i) => isset($i['descripcion']))
            ->map(fn($i) => [
                'descripcion' => $i['descripcion'],
                'precio' => (float) ($i['precio'] ?? 0),
            ]);

        return Pdf::loadView('pdf.boleta_servicio', compact('servicio', 'servicios_cliente'))
            ->stream("boleta-servicio-{$servicio->codigo_nota}.pdf");
    }

    public function recibo80mm(ServicioTecnico $servicio)
    {
        $this->authorizeServicioAccess($servicio);

        $servicios_cliente = collect(json_decode($servicio->detalle_servicio, true));

        return Pdf::loadView('pdf.recibo_servicio_80mm', compact('servicio', 'servicios_cliente'))
            ->setPaper([0, 0, 226.77, 600], 'portrait')
            ->stream("recibo-{$servicio->codigo_nota}.pdf");
    }
}
