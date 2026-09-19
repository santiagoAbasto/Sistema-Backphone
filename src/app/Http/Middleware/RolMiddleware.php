<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;

class RolMiddleware
{
    /**
     * Verifica que el usuario autenticado tenga el rol requerido.
     *
     * Mejoras de seguridad:
     *  - Se comprueba que el usuario esté autenticado ANTES de comprobar el rol.
     *  - Si no está autenticado, se redirige al login en lugar de 403.
     *  - El rol se compara con === (strict) para evitar type-juggling.
     *  - Se soportan múltiples roles separados por pipe: 'rol:admin|vendedor'
     */
    public function handle($request, Closure $next, string ...$roles)
    {
        // 1. Sin sesión activa → login
        if (! Auth::check()) {
            return redirect()->route('login');
        }

        $userRol = Auth::user()->rol;

        // 2. Soporte para roles múltiples: 'rol:admin|vendedor'
        // Si se pasó un solo string con pipes lo descomponemos
        $allowed = [];
        foreach ($roles as $r) {
            foreach (explode('|', $r) as $part) {
                $allowed[] = trim($part);
            }
        }

        if (in_array($userRol, $allowed, true)) {
            return $next($request);
        }

        // 3. Rol incorrecto → 403
        abort(403, 'No autorizado.');
    }
}
