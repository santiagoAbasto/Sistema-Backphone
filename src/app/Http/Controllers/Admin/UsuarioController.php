<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Sucursal;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sistema → Usuarios y roles: quién entra al panel y qué parte puede abrir.
 *
 * El rol de cada persona se guarda en `users.rol` (la misma columna de siempre) y cada rol dice, en la tabla
 * `roles`, qué módulos del panel abre. `PermisoMiddleware` lo hace cumplir en el servidor, así que lo que no se ve
 * en el menú tampoco se abre escribiendo la dirección.
 *
 * Al dar acceso se eligen dos cosas: **el rol** (qué módulos abre) y **la sucursal** (con cuál
 * trabaja). Sin sucursal, la cuenta es super administradora: ve todas y puede filtrar.
 *
 * Barandas que no se pueden saltar:
 * - Nadie se cambia el rol ni la sucursal a sí mismo, ni se borra a sí mismo.
 * - Siempre queda al menos un administrador y al menos un super administrador.
 * - Quien está atado a una sucursal solo ve y crea cuentas de la suya, y no puede crear
 *   super administradores: no se puede repartir más alcance del que uno tiene.
 * - La contraseña solo se escribe, nunca se lee ni se muestra.
 */
class UsuarioController extends Controller
{
    public function index(Request $request): Response
    {
        $q      = trim((string) $request->string('q'));
        $filtro = (string) $request->string('rol', 'todos');

        $yo          = $request->user();
        $superAdmin  = $yo->esSuperAdmin();

        $usuarios = User::query()
            // Quien está atado a una sucursal solo ve las cuentas de la suya
            ->when(! $superAdmin, fn ($qb) => $qb->where('sucursal_id', $yo->sucursal_id))
            ->when($filtro !== 'todos', fn ($qb) => $qb->where('rol', $filtro))
            ->when($q !== '', function ($qb) use ($q) {
                $like = \App\Support\Busqueda::contiene($q);
                $qb->where(fn ($w) => $w
                    ->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like]));
            })
            ->orderByRaw("case when rol = 'admin' then 0 else 1 end")
            ->orderBy('name')
            ->get();

        $roles = Role::orderBy('orden')->orderBy('id')->get();
        $porRol = User::selectRaw('rol, count(*) as total')->groupBy('rol')->pluck('total', 'rol');
        $sucursales = Sucursal::activas();

        return Inertia::render('Admin/Usuarios/Index', [
            'usuarios' => $usuarios->map(fn (User $u) => $this->paraElPanel($u, $roles))->values(),
            'roles'    => $roles->map(fn (Role $r) => [
                'id'          => $r->id,
                'clave'       => $r->clave,
                'nombre'      => $r->nombre,
                'descripcion' => $r->descripcion,
                'permisos'    => $r->permisosReales(),
                'del_sistema'  => $r->del_sistema,
                'panel_propio' => $r->panel_propio,
                'activo'       => $r->activo,
                'usuarios'    => (int) ($porRol[$r->clave] ?? 0),
                'todo'        => in_array(Permisos::TODO, $r->permisosReales(), true),
            ])->values(),
            'permisos' => Permisos::porGrupo(),
            'filtros'  => ['q' => $q, 'rol' => $filtro],
            'yo'       => $yo->id,
            // Con qué alcance se está mirando la pantalla: define si aparece la opción «Todas»
            'soySuperAdmin' => $superAdmin,
            'miSucursal'    => $yo->sucursal_id,
            'sucursales'    => $sucursales->map(fn (Sucursal $s) => [
                'id' => $s->id, 'nombre' => $s->nombre, 'prefijo' => $s->prefijo, 'ciudad' => $s->ciudad,
            ])->values(),
            'resumen'  => [
                'usuarios' => $usuarios->count(),
                'total'    => User::count(),
                'admins'   => User::where('rol', 'admin')->count(),
                'roles'    => $roles->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'email:rfc', 'max:191', 'unique:users,email'],
            'rol'      => ['required', 'string', Rule::exists('roles', 'clave')->where('activo', true)],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'meta_mensual' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            // null = super administrador (ve todas las sucursales)
            'sucursal_id' => ['nullable', 'integer', Rule::exists('sucursales', 'id')->where('activa', true)],
        ], $this->mensajes());

        if ($error = $this->sucursalPermitida($request, $data['sucursal_id'] ?? null)) {
            return back()->withErrors(['sucursal_id' => $error]);
        }

        $user = new User();
        $user->name  = strip_tags($data['name']);
        $user->email = Str::lower($data['email']);
        $user->password = Hash::make($data['password']);
        // Ni el rol ni la sucursal se asignan en masa: se escriben acá, después de validarlos
        $user->rol = $data['rol'];
        $user->sucursal_id = $data['sucursal_id'] ?? null;
        // Meta del mes que ve en su panel; 0 = sin meta
        $user->meta_mensual = round((float) ($data['meta_mensual'] ?? 0), 2);
        $user->email_verified_at = now();
        $user->save();

        return back()->with('success', $user->name . ' ya puede entrar al panel' . $this->dondeTrabaja($user) . '.');
    }

    public function update(Request $request, User $usuario): RedirectResponse
    {
        $esYo = $request->user()->id === $usuario->id;

        $data = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'email:rfc', 'max:191', Rule::unique('users', 'email')->ignore($usuario->id)],
            'rol'      => ['required', 'string', Rule::exists('roles', 'clave')->where('activo', true)],
            'password' => ['nullable', 'confirmed', Password::min(8)->letters()->numbers()],
            'meta_mensual' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'sucursal_id' => ['nullable', 'integer', Rule::exists('sucursales', 'id')->where('activa', true)],
        ], $this->mensajes());

        $sucursalNueva = $data['sucursal_id'] ?? null;

        // Quien está atado a una sucursal no puede mover cuentas fuera de ella
        abort_unless($request->user()->alcanza($usuario->sucursal_id), 403);

        if ($error = $this->sucursalPermitida($request, $sucursalNueva)) {
            return back()->withErrors(['sucursal_id' => $error]);
        }

        if ($esYo && $sucursalNueva !== $usuario->sucursal_id) {
            return back()->withErrors(['sucursal_id' => 'No puedes cambiarte la sucursal a ti mismo. Pedíselo a otro super administrador.']);
        }

        if ($usuario->esSuperAdmin() && $sucursalNueva !== null && $this->ultimoSuperAdmin($usuario)) {
            return back()->withErrors(['sucursal_id' => 'Es el único super administrador: si lo atás a una sucursal, nadie vería el negocio completo.']);
        }

        if ($esYo && $data['rol'] !== $usuario->rol) {
            return back()->withErrors(['rol' => 'No puedes cambiarte el rol a ti mismo. Pídeselo a otro administrador.']);
        }

        if (! $esYo && $usuario->rol === 'admin' && $data['rol'] !== 'admin' && $this->ultimoAdmin($usuario)) {
            return back()->withErrors(['rol' => 'Es el único administrador: si le cambias el rol, nadie podría entrar a configurar la tienda.']);
        }

        $usuario->name  = strip_tags($data['name']);
        $usuario->email = Str::lower($data['email']);
        $usuario->rol   = $data['rol'];
        $usuario->sucursal_id = $sucursalNueva;
        $usuario->meta_mensual = round((float) ($data['meta_mensual'] ?? 0), 2);

        if (filled($data['password'] ?? null)) {
            $usuario->password = Hash::make($data['password']);
        }

        $usuario->save();

        return back()->with('success', 'Los datos de ' . $usuario->name . ' quedaron guardados.');
    }

    public function destroy(Request $request, User $usuario): RedirectResponse
    {
        if ($request->user()->id === $usuario->id) {
            return back()->withErrors(['usuario' => 'No puedes borrar tu propia cuenta.']);
        }

        abort_unless($request->user()->alcanza($usuario->sucursal_id), 403);

        if ($usuario->rol === 'admin' && $this->ultimoAdmin($usuario)) {
            return back()->withErrors(['usuario' => 'Es el único administrador: no se puede borrar.']);
        }

        if ($usuario->esSuperAdmin() && $this->ultimoSuperAdmin($usuario)) {
            return back()->withErrors(['usuario' => 'Es el único super administrador: si lo borrás, nadie vería el negocio completo.']);
        }

        $nombre = $usuario->name;
        $usuario->delete();

        return back()->with('success', $nombre . ' ya no tiene acceso al panel.');
    }

    private function ultimoAdmin(User $usuario): bool
    {
        return User::where('rol', 'admin')->where('id', '!=', $usuario->id)->doesntExist();
    }

    private function ultimoSuperAdmin(User $usuario): bool
    {
        return User::whereNull('sucursal_id')->where('id', '!=', $usuario->id)->doesntExist();
    }

    /**
     * ¿Quien está creando o editando puede poner a alguien en esa sucursal?
     * Devuelve el mensaje de error, o null si está bien.
     */
    private function sucursalPermitida(Request $request, ?int $sucursalId): ?string
    {
        if ($request->user()->esSuperAdmin()) {
            return null;
        }

        if ($sucursalId === null) {
            return 'No podés crear super administradores: solo alguien que ya ve todas las sucursales puede hacerlo.';
        }

        if ((int) $sucursalId !== (int) $request->user()->sucursal_id) {
            return 'Solo podés dar acceso a tu propia sucursal.';
        }

        return null;
    }

    /** « en Cochabamba » o « , y ve todas las sucursales », para el mensaje de confirmación. */
    private function dondeTrabaja(User $usuario): string
    {
        if ($usuario->esSuperAdmin()) {
            return ' y ve todas las sucursales';
        }

        $nombre = Sucursal::where('id', $usuario->sucursal_id)->value('nombre');

        return $nombre ? " en {$nombre}" : '';
    }

    private function paraElPanel(User $u, $roles): array
    {
        $rol = $roles->firstWhere('clave', $u->rol);

        return [
            'id'          => $u->id,
            'name'        => $u->name,
            'email'       => $u->email,
            'rol'         => $u->rol,
            'rol_nombre'  => $rol?->nombre ?? $u->rol,
            'rol_activo'  => (bool) ($rol?->activo ?? false),
            'panel_propio' => (bool) ($rol?->panel_propio ?? false),
            'meta_mensual' => (float) $u->meta_mensual,
            'sucursal_id'  => $u->sucursal_id,
            'created_at'  => $u->created_at?->toIso8601String(),
        ];
    }

    private function mensajes(): array
    {
        return [
            'name.required'      => 'Escribe el nombre de la persona: es el que se ve en el panel.',
            'email.required'     => 'El correo es con el que entra al panel.',
            'email.email'        => 'Escribe un correo válido.',
            'email.unique'       => 'Ya hay una cuenta con ese correo.',
            'rol.required'       => 'Elige qué rol tiene.',
            'rol.exists'         => 'Ese rol no existe o está apagado.',
            'sucursal_id.exists' => 'Esa sucursal no existe o está apagada.',
            'password.required'  => 'Escribe una contraseña para que pueda entrar.',
            'password.confirmed' => 'Las dos contraseñas no son iguales.',
            'password.min'       => 'La contraseña necesita al menos :min caracteres.',
            'password.letters'   => 'La contraseña tiene que tener letras y números.',
            'password.numbers'   => 'La contraseña tiene que tener letras y números.',
            'meta_mensual.numeric' => 'Escribe la meta del mes en números, sin puntos ni letras.',
            'meta_mensual.min'     => 'La meta no puede ser negativa.',
            'meta_mensual.max'     => 'Esa meta es demasiado grande.',
        ];
    }
}
