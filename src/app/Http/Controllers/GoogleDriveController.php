<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Google_Client;
use Google_Service_Drive;
use Illuminate\Support\Facades\Session;

class GoogleDriveController extends Controller
{
    public function redirectToGoogle(Request $request)
    {
        // state anti-CSRF: un valor aleatorio que guardamos en sesión y verificamos al volver.
        // Sin esto, un atacante podía forzar el callback con SU code y conectar la tienda a su Drive.
        $state = bin2hex(random_bytes(32));
        $request->session()->put('google_oauth_state', $state);

        $client = new Google_Client();
        $client->setClientId(env('GOOGLE_CLIENT_ID'));
        $client->setClientSecret(env('GOOGLE_CLIENT_SECRET'));
        $client->setRedirectUri(env('GOOGLE_REDIRECT_URI'));
        $client->setAccessType('offline');
        $client->setPrompt('consent');
        $client->setState($state);
        $client->addScope(Google_Service_Drive::DRIVE_FILE);

        $authUrl = $client->createAuthUrl();
        return redirect($authUrl);
    }

    public function handleGoogleCallback(Request $request)
    {
        // Verifica el state antes de canjear nada: si no coincide, se aborta (posible CSRF).
        $esperado = $request->session()->pull('google_oauth_state');
        if (! $esperado || ! is_string($request->input('state')) || ! hash_equals($esperado, $request->input('state'))) {
            return redirect()->route('admin.cotizaciones.index')
                ->with('error', 'No se pudo validar la conexión con Google Drive. Intentá de nuevo.');
        }

        if (! $request->filled('code')) {
            return redirect()->route('admin.cotizaciones.index')
                ->with('error', 'Google no devolvió un código de autorización.');
        }

        $client = new Google_Client();
        $client->setClientId(env('GOOGLE_CLIENT_ID'));
        $client->setClientSecret(env('GOOGLE_CLIENT_SECRET'));
        $client->setRedirectUri(env('GOOGLE_REDIRECT_URI'));

        $accessToken = $client->fetchAccessTokenWithAuthCode($request->input('code'));

        if (isset($accessToken['error'])) {
            return redirect()->route('admin.cotizaciones.index')
                ->with('error', 'Google rechazó la autorización.');
        }

        // Guarda el token en archivo (fuera de public/) y en sesión.
        $ruta = storage_path('app/google/token.json');
        if (! is_dir(dirname($ruta))) {
            mkdir(dirname($ruta), 0700, true);
        }
        file_put_contents($ruta, json_encode($accessToken));

        Session::put('google_access_token', $accessToken);

        return redirect()->route('admin.cotizaciones.index')->with('success', 'Autenticación con Google Drive exitosa.');
    }
}
