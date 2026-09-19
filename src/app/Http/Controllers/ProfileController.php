<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\Role;
use App\Services\FotoDePerfil;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Mi perfil: lo que cada persona puede cambiar de su propia cuenta.
 *
 * Solo el nombre, el correo, la foto y la contraseña. El rol y la sucursal son decisión de un
 * administrador y acá se muestran como dato, no como campo: nadie se amplía el acceso a sí mismo.
 *
 * Tampoco existe «borrar mi cuenta»: en un sistema con ventas a nombre de cada persona, una cuenta
 * no se borra sola. La da de baja un administrador desde Usuarios y roles.
 */
class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $usuario = $request->user();
        $rol = Role::where('clave', $usuario->rol)->first();

        return Inertia::render('Profile/Edit', [
            'estado' => session('status'),
            'cuenta' => [
                'name'        => $usuario->name,
                'email'       => $usuario->email,
                'foto_url'    => $usuario->foto_url,
                'iniciales'   => $usuario->iniciales,
                'rol'         => $usuario->rol,
                'rol_nombre'  => $rol?->nombre ?? Str::ucfirst($usuario->rol),
                'rol_descripcion' => $rol?->descripcion,
                'sucursal'    => $usuario->sucursal?->nombre,
                'es_super_admin' => $usuario->esSuperAdmin(),
                'desde'       => $usuario->created_at?->toIso8601String(),
                'meta_mensual' => (float) $usuario->meta_mensual,
            ],
        ]);
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $usuario = $request->user();
        $usuario->fill($request->validated());

        if ($usuario->isDirty('email')) {
            $usuario->email_verified_at = null;
        }

        $usuario->save();

        return back()->with('success', 'Tus datos quedaron guardados.');
    }

    /** Cambia la foto de perfil. */
    public function foto(Request $request, FotoDePerfil $fotos): RedirectResponse
    {
        $request->validate([
            'foto' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120', 'dimensions:min_width=120,min_height=120'],
        ], [
            'foto.required'   => 'Elegí una imagen.',
            'foto.image'      => 'Ese archivo no es una imagen.',
            'foto.mimes'      => 'La foto tiene que ser JPG, PNG o WEBP.',
            'foto.max'        => 'La foto no puede pesar más de 5 MB.',
            'foto.dimensions' => 'La imagen es muy chica: necesita al menos 120 × 120 píxeles.',
        ]);

        $usuario = $request->user();

        try {
            $usuario->foto = $fotos->guardar($usuario, $request->file('foto'));
        } catch (\Throwable) {
            return back()->withErrors(['foto' => 'No se pudo procesar esa imagen. Probá con otra.']);
        }

        $usuario->save();

        return back()->with('success', 'Tu foto quedó actualizada.');
    }

    /** Vuelve a las iniciales. */
    public function quitarFoto(Request $request, FotoDePerfil $fotos): RedirectResponse
    {
        $usuario = $request->user();

        if (! $usuario->foto) {
            return back();
        }

        $fotos->quitar($usuario);
        $usuario->foto = null;
        $usuario->save();

        return back()->with('success', 'Tu foto se quitó: vuelven tus iniciales.');
    }
}
