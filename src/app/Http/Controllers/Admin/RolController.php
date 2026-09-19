<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Los roles del panel: un nombre, una explicación y los módulos que abre.
 *
 * `admin` y `vendedor` son del sistema: no se borran ni se les cambia la clave, y el administrador siempre lo puede
 * todo (sus permisos no se editan). Un rol con gente asignada tampoco se borra: primero hay que mover a esa gente.
 */
class RolController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'nombre'      => ['required', 'string', 'max:60'],
            'descripcion' => ['nullable', 'string', 'max:200'],
            'permisos'    => ['array'],
            'permisos.*'  => ['string', Rule::in(Permisos::claves())],
        ], $this->mensajes());

        $permisos = Permisos::limpiar($data['permisos'] ?? []);

        if ($permisos === []) {
            return back()->withErrors(['permisos' => 'Elige al menos un módulo: un rol sin nada marcado no puede abrir ninguna parte del panel.']);
        }

        $clave = $this->claveLibre($data['nombre']);

        Role::create([
            'clave'       => $clave,
            'nombre'      => strip_tags($data['nombre']),
            'descripcion' => isset($data['descripcion']) ? strip_tags($data['descripcion']) : null,
            'permisos'    => $permisos,
            'del_sistema' => false,
            'activo'      => true,
            'orden'       => (int) Role::max('orden') + 1,
        ]);

        return back()->with('success', 'El rol «' . $data['nombre'] . '» quedó creado.');
    }

    public function update(Request $request, Role $rol): RedirectResponse
    {
        $data = $request->validate([
            'nombre'      => ['required', 'string', 'max:60'],
            'descripcion' => ['nullable', 'string', 'max:200'],
            'permisos'    => ['array'],
            'permisos.*'  => ['string', Rule::in(Permisos::claves())],
            'activo'      => ['boolean'],
        ], $this->mensajes());

        $activo = $request->boolean('activo', $rol->activo);

        if (! $activo && $rol->del_sistema) {
            return back()->withErrors(['activo' => 'Los roles del sistema no se pueden apagar.']);
        }

        if (! $activo && $rol->users()->exists()) {
            return back()->withErrors(['activo' => 'Hay gente con este rol: muévela a otro antes de apagarlo.']);
        }

        // Al administrador solo se le cambia el nombre y la explicación: siempre lo puede todo
        $permisos = $rol->esAdmin()
            ? [Permisos::TODO]
            : Permisos::limpiar($data['permisos'] ?? []);

        // El vendedor tiene su propio panel: puede quedarse sin módulos del de administración
        if (! $rol->esAdmin() && ! $rol->panel_propio && $permisos === []) {
            return back()->withErrors(['permisos' => 'Elige al menos un módulo: un rol sin nada marcado no puede abrir ninguna parte del panel.']);
        }

        $rol->update([
            'nombre'      => strip_tags($data['nombre']),
            'descripcion' => isset($data['descripcion']) ? strip_tags($data['descripcion']) : null,
            'permisos'    => $permisos,
            'activo'      => $activo,
        ]);

        return back()->with('success', 'El rol «' . $rol->nombre . '» quedó guardado.');
    }

    public function destroy(Role $rol): RedirectResponse
    {
        if ($rol->del_sistema) {
            return back()->withErrors(['rol' => 'Los roles del sistema no se pueden borrar.']);
        }

        $cuantos = $rol->users()->count();
        if ($cuantos > 0) {
            return back()->withErrors(['rol' => $cuantos === 1
                ? 'Hay una persona con este rol: muévela a otro antes de borrarlo.'
                : "Hay {$cuantos} personas con este rol: muévelas a otro antes de borrarlo."]);
        }

        $nombre = $rol->nombre;
        $rol->delete();

        return back()->with('success', 'El rol «' . $nombre . '» se borró.');
    }

    /** Una clave a partir del nombre, sin pisar a otro rol: «Encargado de tienda» → «encargado-de-tienda». */
    private function claveLibre(string $nombre): string
    {
        $base = Str::slug($nombre) ?: 'rol';
        $clave = Str::limit($base, 36, '');
        $n = 1;

        while (Role::where('clave', $clave)->exists() || in_array($clave, ['admin', 'vendedor'], true)) {
            $n++;
            $clave = Str::limit($base, 34, '') . '-' . $n;
        }

        return $clave;
    }

    private function mensajes(): array
    {
        return [
            'nombre.required' => 'El rol necesita un nombre: es el que se elige al crear un usuario.',
            'nombre.max'      => 'El nombre del rol no puede pasar de :max caracteres.',
            'permisos.*.in'   => 'Uno de los módulos elegidos no existe.',
        ];
    }
}
