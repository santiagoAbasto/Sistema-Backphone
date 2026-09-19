<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AutomationTokenMiddleware
{
    /**
     * Protege las rutas de automatización (n8n → Laravel) con un token por ámbito.
     *
     * Ámbitos:
     *  - 'default' (n8n: test, top-products, reports): acepta el token principal y, durante
     *              una rotación, los tokens previos (para no cortar n8n mientras se actualiza).
     *  - 'export'  (export financiero con costo y ganancia): usa un token APARTE. Si está vacío,
     *              el endpoint queda cerrado (falla segura). n8n no usa este ámbito.
     *
     * Siempre se compara con hash_equals (evita timing attacks) y se responde 401 sin caché.
     */
    public function handle(Request $request, Closure $next, string $ambito = 'default'): Response
    {
        $token   = (string) $request->header('X-AUTOMATION-TOKEN', '');
        $validos = $this->tokensValidos($ambito);

        foreach ($validos as $esperado) {
            if ($esperado !== '' && hash_equals($esperado, $token)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'Unauthorized automation request.',
        ], 401)->withHeaders([
            'Cache-Control' => 'no-store',
            'Pragma'        => 'no-cache',
        ]);
    }

    /** Lista de tokens válidos para el ámbito pedido (falla cerrada si está vacía). */
    private function tokensValidos(string $ambito): array
    {
        if ($ambito === 'export') {
            return array_values(array_filter([(string) config('automation.export_token', '')]));
        }

        $principal = (string) config('automation.token', '');
        $previos   = array_filter(array_map('trim', explode(',', (string) config('automation.tokens_previos', ''))));

        return array_values(array_filter(array_merge([$principal], $previos)));
    }
}
