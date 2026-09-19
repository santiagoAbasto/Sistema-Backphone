<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sistema → Sucursales.
 *
 * Solo entra un super administrador: quien está atado a una sucursal no puede crear otras ni
 * cambiarle el nombre a la de al lado. Una sucursal no se borra si tiene movimiento; se apaga,
 * y así deja de aparecer en el selector sin perder su historial.
 */
class SucursalController extends Controller
{
    /** Las tablas que cuentan como «movimiento» al decidir si una sucursal se puede borrar. */
    private const CON_MOVIMIENTO = [
        'ventas' => 'ventas', 'reservas' => 'reservas', 'servicio_tecnicos' => 'servicios técnicos',
        'cotizaciones' => 'cotizaciones', 'egresos' => 'egresos', 'clientes' => 'clientes',
        'celulares' => 'celulares', 'computadoras' => 'computadoras',
        'productos_apple' => 'equipos de marca', 'productos_generales' => 'accesorios',
    ];

    public function index(Request $request): Response
    {
        $this->soloSuperAdmin($request);

        $sucursales = Sucursal::orderBy('orden')->orderBy('id')->get()->map(fn (Sucursal $s) => [
            'id'        => $s->id,
            'nombre'    => $s->nombre,
            'prefijo'   => $s->prefijo,
            'ciudad'    => $s->ciudad,
            'direccion' => $s->direccion,
            'telefono'  => $s->telefono,
            'activa'    => $s->activa,
            'orden'     => $s->orden,
            'personas'  => User::where('sucursal_id', $s->id)->count(),
            'movimiento' => $this->tieneMovimiento($s->id),
        ]);

        return Inertia::render('Admin/Sucursales/Index', [
            'sucursales'    => $sucursales,
            'superAdmins'   => User::whereNull('sucursal_id')->count(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->soloSuperAdmin($request);

        $datos = $this->validar($request);

        Sucursal::create($datos + ['orden' => (int) Sucursal::max('orden') + 1]);

        return back()->with('success', "Sucursal «{$datos['nombre']}» creada.");
    }

    public function update(Request $request, Sucursal $sucursal): RedirectResponse
    {
        $this->soloSuperAdmin($request);

        $sucursal->update($this->validar($request, $sucursal));

        return back()->with('success', 'Sucursal actualizada.');
    }

    /** Encender o apagar. Una sucursal apagada no aparece en el selector ni recibe registros nuevos. */
    public function visibilidad(Request $request, Sucursal $sucursal): RedirectResponse
    {
        $this->soloSuperAdmin($request);

        if ($sucursal->activa && Sucursal::where('activa', true)->count() <= 1) {
            return back()->with('error', 'Tiene que quedar al menos una sucursal encendida.');
        }

        $sucursal->update(['activa' => ! $sucursal->activa]);

        return back()->with('success', $sucursal->activa
            ? "«{$sucursal->nombre}» quedó encendida."
            : "«{$sucursal->nombre}» quedó apagada: no aparece en el selector.");
    }

    public function destroy(Request $request, Sucursal $sucursal): RedirectResponse
    {
        $this->soloSuperAdmin($request);

        if ($movimiento = $this->tieneMovimiento($sucursal->id)) {
            return back()->with('error', "No se puede eliminar: tiene {$movimiento}. Apagala en vez de borrarla.");
        }

        if (User::where('sucursal_id', $sucursal->id)->exists()) {
            return back()->with('error', 'No se puede eliminar: hay cuentas asignadas a esta sucursal.');
        }

        if (Sucursal::count() <= 1) {
            return back()->with('error', 'El sistema necesita al menos una sucursal.');
        }

        $nombre = $sucursal->nombre;
        $sucursal->delete();

        return back()->with('success', "Sucursal «{$nombre}» eliminada.");
    }

    /** @return array<string, mixed> */
    private function validar(Request $request, ?Sucursal $sucursal = null): array
    {
        return $request->validate([
            'nombre'    => ['required', 'string', 'max:80'],
            'prefijo'   => ['required', 'string', 'max:6', 'regex:/^[A-Za-z0-9]+$/',
                            Rule::unique('sucursales', 'prefijo')->ignore($sucursal?->id)],
            'ciudad'    => ['nullable', 'string', 'max:80'],
            'direccion' => ['nullable', 'string', 'max:200'],
            'telefono'  => ['nullable', 'string', 'max:40'],
        ], [
            'nombre.required'  => 'La sucursal necesita un nombre.',
            'prefijo.required' => 'El prefijo es lo que va adelante de cada código de nota.',
            'prefijo.regex'    => 'El prefijo va sin espacios ni signos: solo letras y números.',
            'prefijo.unique'   => 'Ese prefijo ya lo usa otra sucursal: los códigos se confundirían.',
        ]);
    }

    /** Qué movimiento tiene una sucursal, en palabras. `null` si no tiene nada. */
    private function tieneMovimiento(int $sucursalId): ?string
    {
        $encontrado = [];

        foreach (self::CON_MOVIMIENTO as $tabla => $etiqueta) {
            $total = \Illuminate\Support\Facades\DB::table($tabla)->where('sucursal_id', $sucursalId)->count();
            if ($total > 0) {
                $encontrado[] = "{$total} " . $etiqueta;
            }
        }

        return $encontrado === [] ? null : implode(', ', array_slice($encontrado, 0, 3));
    }

    /** Solo un super administrador administra las sucursales. */
    private function soloSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->esSuperAdmin(), 403, 'Solo un super administrador administra las sucursales.');
    }
}
