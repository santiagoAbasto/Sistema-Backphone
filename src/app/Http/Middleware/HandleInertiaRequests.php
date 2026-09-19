<?php

namespace App\Http\Middleware;

use App\Models\ConfiguracionNegocio;
use App\Support\SucursalActiva;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        if (app()->environment(['local', 'testing'])) {
            return null;
        }

        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                // Qué módulos del panel abre su rol: el menú esconde lo que el servidor va a rechazar igual
                'permisos' => fn () => $request->user()
                    ? \App\Models\Role::mapa()[$request->user()->rol] ?? ($request->user()->rol === 'admin' ? ['*'] : [])
                    : [],
            ],
            // Identidad del negocio: la lee el encabezado del panel y la portada de los comprobantes.
            // Lista blanca explícita — nunca salen por acá claves, tokens ni datos de SMTP.
            'negocio' => fn () => $request->user() ? ConfiguracionNegocio::paraElPanel() : null,
            // Con qué sucursal se está trabajando y cuáles puede abrir esta cuenta.
            // El nombre es distinto del prop `sucursales` de la pantalla de Sucursales a propósito:
            // un prop de pantalla pisa al compartido, y el selector del encabezado se quedaba vacío.
            'sucursalActiva' => fn () => $request->user() ? SucursalActiva::paraElPanel() : null,
            'flash'   => fn () => $request->hasSession() ? [
                'success' => $request->session()->get('success'),
                'error'   => $request->session()->get('error'),
            ] : [],
        ];
    }
}
