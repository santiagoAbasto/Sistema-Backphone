<?php

namespace App\Http\Controllers;

use App\Models\Caja;
use App\Models\Sucursal;
use App\Services\EfectivoDeCaja;
use App\Support\SucursalActiva;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Apertura y cierre diario de la caja de cada sucursal.
 *
 * El vendedor cuenta a ciegas: hasta cerrar no ve cuánto debería haber, así lo que anota es lo
 * que contó y no el número que esperaba. El panel de administración lo ve en vivo.
 */
class CajaController extends Controller
{
    private const ZONA = 'America/La_Paz';

    public function index(Request $request)
    {
        $hoy     = $this->hoy();
        $aCiegas = $request->routeIs('vendedor.*');

        $activa = SucursalActiva::id();
        $cajas  = Sucursal::activas()
            ->when($activa, fn ($s) => $s->where('id', $activa))
            ->map(fn (Sucursal $s) => [
                'sucursal' => ['id' => $s->id, 'nombre' => $s->nombre],
                'caja'     => ($caja = $this->cajaDelDia($s->id, $hoy)) ? $this->presentar($caja, $aCiegas, true) : null,
            ])
            ->values();

        $historial = Caja::with(['sucursal:id,nombre', 'quienAbrio:id,name', 'quienCerro:id,name'])
            ->whereNotNull('cerrada_en')
            ->orderByDesc('fecha')->orderBy('sucursal_id')
            ->limit(30)
            ->get()
            ->map(fn (Caja $c) => $this->presentar($c, false, false));

        return Inertia::render($request->routeIs('admin.*') ? 'Admin/Caja/Index' : 'Vendedor/Caja/Index', [
            'hoy'       => $hoy,
            'cajas'     => $cajas,
            'historial' => $historial,
            'aCiegas'   => $aCiegas,
        ]);
    }

    public function abrir(Request $request)
    {
        $datos = $request->validate([
            'sucursal_id'    => ['required', 'integer', 'exists:sucursales,id'],
            'monto_apertura' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ], [
            'monto_apertura.required' => 'Anota con cuánto efectivo arranca la caja.',
            'monto_apertura.numeric'  => 'El monto tiene que ser un número.',
            'monto_apertura.min'      => 'El monto no puede ser negativo.',
        ]);

        $sucursalId = (int) $datos['sucursal_id'];
        abort_unless($request->user()->alcanza($sucursalId), 403);

        $hoy = $this->hoy();

        // Un día no se mezcla con otro: la que quedó abierta se cierra primero, con su conteo
        if ($pendiente = Caja::where('sucursal_id', $sucursalId)->abiertas()->where('fecha', '<', $hoy)->first()) {
            throw ValidationException::withMessages([
                'monto_apertura' => 'La caja del ' . $pendiente->fecha->format('d/m') . ' quedó sin cerrar: ciérrala antes de abrir la de hoy.',
            ]);
        }

        try {
            Caja::create([
                'sucursal_id'    => $sucursalId,
                'fecha'          => $hoy,
                'monto_apertura' => round((float) $datos['monto_apertura'], 2),
                'abierta_por'    => $request->user()->id,
                'abierta_en'     => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            // Dos personas abriendo a la vez: la base deja pasar a una sola
            throw ValidationException::withMessages(['monto_apertura' => 'La caja de hoy ya está abierta.']);
        }

        return back()->with('success', 'Caja abierta.');
    }

    public function cerrar(Request $request, Caja $caja)
    {
        abort_unless($request->user()->alcanza($caja->sucursal_id), 403);

        $datos = $request->validate([
            'monto_contado' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'notas'         => ['nullable', 'string', 'max:1000'],
        ], [
            'monto_contado.required' => 'Anota cuánto efectivo contaste en la caja.',
            'monto_contado.numeric'  => 'El monto tiene que ser un número.',
            'monto_contado.min'      => 'El monto no puede ser negativo.',
        ]);

        DB::transaction(function () use ($request, $caja, $datos) {
            // Bloqueada: si dos personas cierran a la vez, la segunda ve que ya se cerró
            $caja = Caja::whereKey($caja->id)->lockForUpdate()->firstOrFail();

            if (! $caja->estaAbierta()) {
                throw ValidationException::withMessages(['monto_contado' => 'Esta caja ya se cerró.']);
            }

            $dia      = $caja->fecha->toDateString();
            $mov      = EfectivoDeCaja::movimientos($caja->sucursal_id, $dia, $dia);
            $esperado = round((float) $caja->monto_apertura + $mov['neto'], 2);
            $contado  = round((float) $datos['monto_contado'], 2);

            $caja->forceFill([
                'efectivo_ventas'    => $mov['ventas'],
                'efectivo_servicios' => $mov['servicios'],
                'efectivo_reservas'  => $mov['reservas'],
                'egresos'            => $mov['egresos'],
                'esperado'           => $esperado,
                'monto_contado'      => $contado,
                'diferencia'         => round($contado - $esperado, 2),
                'notas'              => $datos['notas'] ?? null,
                'cerrada_por'        => $request->user()->id,
                'cerrada_en'         => now(),
            ])->save();
        });

        return back()->with('success', 'Caja cerrada.');
    }

    private function hoy(): string
    {
        return now(self::ZONA)->toDateString();
    }

    /** La caja que importa hoy: una que quedó abierta de otro día, o si no la de hoy. */
    private function cajaDelDia(int $sucursalId, string $hoy): ?Caja
    {
        return Caja::where('sucursal_id', $sucursalId)->abiertas()->where('fecha', '<', $hoy)->orderBy('fecha')->first()
            ?? Caja::where('sucursal_id', $sucursalId)->whereDate('fecha', $hoy)->first();
    }

    private function presentar(Caja $caja, bool $aCiegas, bool $conLoQueEntroDespues): array
    {
        $caja->loadMissing(['quienAbrio:id,name', 'quienCerro:id,name']);
        $dia     = $caja->fecha->toDateString();
        $abierta = $caja->estaAbierta();

        // Abierta: se calcula en vivo. Cerrada: lo que quedó firmado al cerrar.
        $vivo = $abierta || $conLoQueEntroDespues ? EfectivoDeCaja::movimientos($caja->sucursal_id, $dia, $dia) : null;
        $mov  = $abierta ? $vivo : [
            'ventas'    => (float) $caja->efectivo_ventas,
            'servicios' => (float) $caja->efectivo_servicios,
            'reservas'  => (float) $caja->efectivo_reservas,
            'egresos'   => (float) $caja->egresos,
            'neto'      => round((float) $caja->esperado - (float) $caja->monto_apertura, 2),
        ];

        $verCuentas = ! ($abierta && $aCiegas);

        return [
            'id'             => $caja->id,
            'fecha'          => $dia,
            'sucursal'       => $caja->relationLoaded('sucursal') ? $caja->sucursal?->nombre : null,
            'abierta'        => $abierta,
            'monto_apertura' => (float) $caja->monto_apertura,
            'abierta_por'    => $caja->quienAbrio?->name,
            'abierta_en'     => $caja->abierta_en?->toIso8601String(),
            'movimientos'    => $verCuentas ? $mov : null,
            'esperado'       => $verCuentas ? round((float) $caja->monto_apertura + $mov['neto'], 2) : null,
            'monto_contado'  => $abierta ? null : (float) $caja->monto_contado,
            'diferencia'     => $abierta ? null : (float) $caja->diferencia,
            'notas'          => $caja->notas,
            'cerrada_por'    => $caja->quienCerro?->name,
            'cerrada_en'     => $caja->cerrada_en?->toIso8601String(),
            // Lo que se movió en efectivo ese día después del cierre: no quedó en ningún conteo
            'despues_del_cierre' => ! $abierta && $vivo !== null ? round($vivo['neto'] - $mov['neto'], 2) : 0.0,
        ];
    }
}
