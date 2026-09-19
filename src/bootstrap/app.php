<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))

    /*
    |--------------------------------------------------------------------------
    | Routing
    |--------------------------------------------------------------------------
    */
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    /*
    | Middleware
    |--------------------------------------------------------------------------
    */
    ->withMiddleware(function (Middleware $middleware) {
        // Proxies de confianza: SOLO los que declares en TRUSTED_PROXIES.
        // Antes estaba en '*' (confiar en todos), lo que dejaba que cualquiera falsee la IP
        // con X-Forwarded-For y así se salte los límites por IP (incluido el bloqueo de login).
        // Por defecto no se confía en nadie: la IP sale de la conexión real y no se puede falsear.
        // En producción, poné acá la IP/red del reverse proxy o del túnel (ej.: "172.16.0.0/12").
        $proxiesConfig = trim((string) env('TRUSTED_PROXIES', ''));
        $middleware->trustProxies(
            at: $proxiesConfig === '*'
                ? '*'
                : array_values(array_filter(array_map('trim', explode(',', $proxiesConfig)))),
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );

        // Baja en un clic (List-Unsubscribe-Post) llega desde clientes de correo, sin sesión ni CSRF
        $middleware->validateCsrfTokens(except: ['newsletter/baja/*']);

        // Middlewares WEB
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\SecurityHeadersMiddleware::class,
        ]);

        // Alias de middlewares (Laravel 12)
        $middleware->alias([
            'rol' => \App\Http\Middleware\RolMiddleware::class,
            // Qué parte del panel puede abrir ese rol (Usuarios y roles)
            'permiso' => \App\Http\Middleware\PermisoMiddleware::class,
            'automation' => \App\Http\Middleware\AutomationTokenMiddleware::class,
        ]);
    })

    /*
    |--------------------------------------------------------------------------
    | Exceptions
    |--------------------------------------------------------------------------
    */
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })

    ->create();
