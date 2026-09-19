<?php

namespace App\Http\Middleware;

use App\Models\Role;
use App\Support\Permisos;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Corta el acceso a un módulo del panel que el rol no tiene permitido.
 *
 * Trabaja junto con `RolMiddleware`, no en su lugar: aquel dice quién entra al panel y este, a qué parte. La regla
 * es la misma que usa el menú (`Role::permite()`), así que lo que no se ve tampoco se puede abrir escribiendo la
 * dirección a mano. Una ruta que no pertenece a ningún módulo (el perfil, cerrar sesión) nunca se bloquea.
 */
class PermisoMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if (! $user) {
            return redirect()->route('login');
        }

        $ruta   = $request->route()?->getName();
        $modulo = Permisos::moduloDeRuta($ruta);

        // Lo que está dentro del panel y no pertenece a ningún módulo queda solo para administradores:
        // así una ruta nueva nunca queda abierta por olvidarse de sumarla al catálogo.
        if ($modulo === null) {
            if (str_starts_with((string) $ruta, 'admin.') && $user->rol !== 'admin') {
                abort(403, 'Tu rol no tiene acceso a esta parte del panel.');
            }

            return $next($request);
        }

        if (! Role::permite($user->rol, $modulo)) {
            abort(403, 'Tu rol no tiene acceso a ' . Permisos::etiqueta($modulo) . '.');
        }

        return $next($request);
    }
}
